// Real Midnight wiring for the DeFa Arc FE (Vite).
//
// Ported from bboard-ui's BrowserDeployedBoardManager: connect the Midnight
// Lace wallet, build browser providers, deploy/join the ConfidentialCreditPool,
// and expose the confidential lender actions (invest = register→deposit→sweep,
// claim, disclose).
//
// Unlike the Next build this needs no SSR discipline — Vite ships this straight
// to the browser, which is why the WASM/top-level-await plugins in
// vite.config.js are the whole story.
// SPDX-License-Identifier: Apache-2.0

import {
  ConfidentialCreditPoolAPI,
  ConfidentialCreditPoolPrivateState,
  confidentialCreditPoolPrivateStateKey,
} from "../../../api/src/index";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import pino from "pino";
import semver from "semver";

const COMPATIBLE_CONNECTOR_API_VERSION = "4.x";

const logger = pino({ level: "info" });

/** Discover the first API-compatible injected Midnight wallet (Lace). */
function getFirstCompatibleWallet() {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet) =>
      !!wallet &&
      typeof wallet === "object" &&
      "apiVersion" in wallet &&
      semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
}

async function connectToWallet(networkId) {
  // Poll briefly for the injected wallet, then connect + authorize.
  const deadline = performance.now() + 8000;
  for (;;) {
    const initial = getFirstCompatibleWallet();
    if (initial) {
      const connected = await initial.connect(networkId);
      await connected.getConnectionStatus();
      return connected;
    }
    if (performance.now() > deadline) {
      throw new Error(
        "Could not find a compatible Midnight Lace wallet. Is the extension installed & enabled?",
      );
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function initializeProviders() {
  const networkId = import.meta.env.VITE_NETWORK_ID ?? "undeployed";
  const connectedAPI = await connectToWallet(networkId);
  const config = await connectedAPI.getConfiguration();
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();

  // Circuit keys/zkir are served from the app origin (copied into public/).
  const zkConfigProvider = new FetchZkConfigProvider(
    window.location.origin,
    fetch.bind(window),
  );

  return {
    privateStateProvider: (
      await import("./in-memory-private-state-provider")
    ).inMemoryPrivateStateProvider(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx) => {
        const serializedTx = toHex(tx.serialize());
        const received = await connectedAPI.balanceUnsealedTransaction(serializedTx);
        return Transaction.deserialize(
          "signature",
          "proof",
          "binding",
          fromHex(received.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx) => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
}

/**
 * Connect Lace, deploy (or join) the ConfidentialCreditPool, and return the
 * confidential lender actions bound to it. Set VITE_CCP_CONTRACT_ADDRESS to
 * join an already-deployed pool instead of deploying a fresh one.
 */
export async function connectAndResolvePool() {
  const providers = await initializeProviders();

  const existing = import.meta.env.VITE_CCP_CONTRACT_ADDRESS;
  const api = existing
    ? await ConfidentialCreditPoolAPI.join(providers, existing, logger)
    : await ConfidentialCreditPoolAPI.deploy(providers, {}, logger);

  const contractAddress = api.deployedContractAddress;
  const coinPk = providers.walletProvider.getCoinPublicKey();

  // Wallet-side plaintext tracking (Phase-1b): OZ's ConfidentialFungibleToken
  // verifies Dec(ciphertext) == plaintext when burning, so the wallet must
  // cache its own spendable plaintext before `claim` can build a burn proof.
  //
  // This MUST survive reloads. An ElGamal position cannot be decrypted back
  // from the chain — the holder knows their balance only because they tracked
  // it. If this reset to 0 on every connect, a returning lender would see a
  // disclosed position of 0 and `claim` would fail the ZK check with
  // "ElGamal: plaintext mismatch". Keyed by contract + wallet so switching
  // either doesn't inherit a stale figure.
  const storeKey = `defa.ccp.${contractAddress}.${coinPk}`;
  const loadTracked = () => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) return { amount: 0n, account: null };
      const p = JSON.parse(raw);
      return {
        amount: BigInt(p.tracked ?? '0'),
        account: p.accountId ? fromHex(p.accountId) : null,
      };
    } catch {
      return { amount: 0n, account: null };
    }
  };
  const saveTracked = () => {
    try {
      localStorage.setItem(
        storeKey,
        JSON.stringify({
          tracked: tracked.toString(),
          accountId: accountId ? toHex(accountId) : null,
        }),
      );
    } catch {
      // Private browsing / storage disabled — the session still works, it just
      // won't survive a reload.
    }
  };

  const restored = loadTracked();
  let accountId = restored.account;
  let tracked = restored.amount;

  const recache = async () => {
    if (!accountId) return;
    providers.privateStateProvider.setContractAddress(contractAddress);
    const ps = await providers.privateStateProvider.get(
      confidentialCreditPoolPrivateStateKey,
    );
    if (!ps) return;
    const ct = await api.positionOf(accountId);
    const ps2 = ConfidentialCreditPoolPrivateState.cachePlaintext(ps, ct, tracked);
    await providers.privateStateProvider.set(confidentialCreditPoolPrivateStateKey, ps2);
    saveTracked();
  };

  /**
   * Resolve this wallet's accountId, registering only if it hasn't been.
   *
   * `registerLender` is one-time — the underlying token asserts
   * "ConfidentialFungibleToken: already registered" on a second call, so
   * calling it unconditionally breaks every deposit after the lender's first.
   * `sweep` also returns the caller's accountId, which is how we recover it for
   * an already-registered lender (e.g. after a page reload, when the in-memory
   * accountId is gone).
   */
  const resolveAccountId = async () => {
    if (accountId) return accountId;
    try {
      accountId = await api.registerLender();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already registered/i.test(msg)) throw e;
      // Already a lender — recover the accountId from sweep's return value.
      accountId = await api.sweep();
    }
    return accountId;
  };

  const actions = {
    invest: async (amount) => {
      // Dual-balance token: deposit lands in PENDING, sweep rolls it into
      // SPENDABLE so positionOf actually reflects it.
      accountId = await resolveAccountId();
      await api.deposit(accountId, amount);
      await api.sweep();
      tracked += amount;
      await recache();
      return { accountId: toHex(accountId) };
    },
    claim: async (amount) => {
      await api.claim(amount);
      tracked = tracked > amount ? tracked - amount : 0n;
      await recache();
    },
    disclose: async () => {
      if (!accountId) throw new Error("No position yet — invest first.");
      const ct = await api.positionOf(accountId);
      const ciphertextHex = `${ct.c1.x.toString(16)}:${ct.c2.x.toString(16)}`;
      // "Decrypt with the viewing key": the wallet resolves the on-chain
      // ciphertext to the plaintext it tracks for its own position.
      return { amount: tracked, ciphertextHex };
    },
    position: () => tracked,
    accountId: () => (accountId ? toHex(accountId) : null),
    state$: () => api.state$,
  };

  return { address: coinPk, contractAddress, actions };
}
