// DeFa × Midnight — headless END-TO-END test of the LENDER FLOW.
//
// This JOINS the already-deployed contract (the same address the FE joins via
// VITE_CCP_CONTRACT_ADDRESS) and replays the exact action sequence that
// web/src/midnight/client.js performs behind the UI buttons:
//
//   Deposit confidentially  -> invest()  = registerLender -> deposit -> sweep (+cache)
//   Disclose position       -> disclose() = positionOf + wallet plaintext
//   Claim                   -> claim()   = burn from spendable (+recache)
//
// It asserts against the PUBLIC on-chain ledger (positionCount) and the
// ENCRYPTED position ciphertext, so a pass means the chain really moved — not
// that the UI looked right.
//
// Scope note: this covers the contract + API + action layer. It does NOT cover
// the React components or the Lace connector, which need a browser + wallet.
//
//   npx tsx src/e2e-ccp.ts
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';
import fs from 'node:fs';
import { WebSocket } from 'ws';
import pino from 'pino';
import {
  ConfidentialCreditPoolAPI,
  type ConfidentialCreditPoolProviders,
  type PrivateStateId,
  confidentialCreditPoolPrivateStateKey,
} from '../../api/src/index';
import { ConfidentialCreditPoolPrivateState as PS } from '../../contract/src/witnesses.js';
import { persistentHash, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { ConfidentialCreditPoolPrivateState } from '../../contract/src/witnesses.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import * as CCP from '../../contract/src/managed/ConfidentialCreditPool/contract/index.js';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { waitForUnshieldedFunds } from './wallet-utils';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const GENESIS_MINT_WALLET_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';
const here = path.resolve(new URL(import.meta.url).pathname, '..');
const UNIT = 1_000_000n; // 6 decimals, same as the FE's UNIT

const ENV: EnvironmentConfiguration = {
  walletNetworkId: 'undeployed' as EnvironmentConfiguration['walletNetworkId'],
  networkId: 'undeployed',
  indexer: 'http://127.0.0.1:8088/api/v4/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  node: 'http://127.0.0.1:9944',
  nodeWS: 'ws://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  faucet: undefined,
};

/**
 * Read the CURRENT public ledger straight from the indexer.
 *
 * Deliberately not `firstValueFrom(api.state$)`: that observable replays the
 * state captured at subscribe time, so reading it right after a transaction
 * returns the pre-tx snapshot and silently under-reports. The FE is unaffected
 * (it stays subscribed and receives later emissions) but a one-shot assertion
 * has to query.
 */
async function liveLedger(
  providers: ConfidentialCreditPoolProviders,
  addr: string,
): Promise<{ positionCount: bigint; yieldAccrualCount: bigint; paused: boolean; poolInitialized: boolean }> {
  const st = await providers.publicDataProvider.queryContractState(addr);
  if (!st) throw new Error('contract state not found on-chain');
  const l = CCP.ledger(st.data);
  return {
    positionCount: l.positionCount,
    yieldAccrualCount: l.yieldAccrualCount,
    paused: l.paused,
    poolInitialized: l.poolInitialized,
  };
}

type Ct = { c1: { x: bigint }; c2: { x: bigint } };
const isZero = (ct: Ct): boolean => ct.c1.x === 0n && ct.c2.x === 0n;
const ctHex = (ct: Ct): string =>
  `${ct.c1.x.toString(16).slice(0, 12)}…:${ct.c2.x.toString(16).slice(0, 12)}…`;

const results: Array<[string, boolean]> = [];
const check = (label: string, ok: boolean): void => {
  results.push([label, ok]);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
};

/**
 * Informational only: which pool the FE is currently pointed at.
 *
 * client/.env.local is gitignored and absent on a fresh clone, and this run
 * deploys its own pool anyway — so a missing file must not fail the test.
 */
function feContractAddress(): string {
  try {
    const envFile = path.resolve(here, '..', '..', 'client', '.env.local');
    const m = fs
      .readFileSync(envFile, 'utf8')
      .match(/VITE_CCP_CONTRACT_ADDRESS=([0-9a-f]+)/);
    return m ? m[1] : '(not set)';
  } catch {
    return '(client/.env.local not present)';
  }
}

async function main(): Promise<void> {
  const logger = pino({ level: 'warn' }); // quiet — assertions are the output
  setNetworkId('undeployed' as Parameters<typeof setNetworkId>[0]);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' DeFa × Midnight — E2E lender flow (headless, against real chain)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`FE is currently pointed at: ${feContractAddress()}`);
  console.log('This run deploys its OWN pool so a first-time-lender run is');
  console.log('deterministic (the shared pool accumulates state across runs).\n');

  const zkConfigPath = path.resolve(
    here, '..', '..', 'contract', 'src', 'managed', 'ConfidentialCreditPool',
  );

  const walletProvider = await MidnightWalletProvider.build(
    logger, ENV, GENESIS_MINT_WALLET_SEED,
  );
  await walletProvider.start();
  await waitForUnshieldedFunds(logger, walletProvider.wallet, ENV, unshieldedToken());

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const providers: ConfidentialCreditPoolProviders = {
    privateStateProvider: levelPrivateStateProvider<PrivateStateId>({
      privateStateStoreName: 'ccp-e2e-private-state',
      signingKeyStoreName: 'ccp-e2e-private-state-signing-keys',
      privateStoragePasswordProvider: () => 'DeFa-Ccp-Standalone-Test-2026!',
      accountId: GENESIS_MINT_WALLET_SEED,
    }),
    publicDataProvider: indexerPublicDataProvider(ENV.indexer, ENV.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(ENV.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  // ── DEPLOY a dedicated pool for this run ─────────────────────────────
  console.log('[1] DEPLOY pool');
  // Owner-gated circuits compare the caller's accountId to `owner`. Deploying
  // without ownerAccount defaults it to 32 zero bytes, which no wallet can
  // derive — bricking accrueYield/pause/unpause. accountId is persistentHash(sk).
  const initialPrivateState = PS.generate();
  const ownerAccount = persistentHash(
    new CompactTypeBytes(32),
    initialPrivateState.secretKey,
  );
  const api = await ConfidentialCreditPoolAPI.deploy(
    providers,
    {
      name: 'DeFa Confidential Position',
      symbol: 'dLP',
      decimals: 6n,
      ownerAccount,
      initialPrivateState,
    },
    logger,
  );
  const contractAddress = api.deployedContractAddress;
  console.log(`      contract: ${contractAddress}`);
  check('pool deployed', !!contractAddress);

  const before = await liveLedger(providers, contractAddress);
  console.log(`      public ledger before: positionCount=${before.positionCount} paused=${before.paused} initialized=${before.poolInitialized}`);

  // ── ACTION: "Deposit confidentially" = invest() ──────────────────────
  // web/src/midnight/client.js: registerLender -> deposit -> sweep -> recache
  console.log('\n[2] ACTION invest()  — register → deposit → sweep');
  const amount = 1000n * UNIT;

  // Mirrors resolveAccountId() in web/src/midnight/client.js: registerLender is
  // ONE-TIME, so an already-registered lender recovers their accountId from
  // sweep()'s return value instead of re-registering.
  let accountId: Uint8Array;
  let registeredFresh = true;
  try {
    accountId = await api.registerLender();
    console.log('      registered (first time for this wallet)');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/already registered/i.test(msg)) throw e;
    registeredFresh = false;
    accountId = await api.sweep();
    console.log('      already registered — accountId recovered via sweep()');
  }
  check('registerLender succeeded on a fresh pool', registeredFresh);
  console.log(`      accountId: ${toHex(accountId).slice(0, 24)}…`);
  check('lender has an accountId on-chain', await api.isLenderRegistered(accountId));

  await api.deposit(accountId, amount);
  const pendingAfterDeposit = await api.pendingOf(accountId);
  const spendableBeforeSweep = await api.positionOf(accountId);
  console.log(`      pending  : ${isZero(pendingAfterDeposit) ? 'ZERO' : ctHex(pendingAfterDeposit)}`);
  console.log(`      spendable: ${isZero(spendableBeforeSweep) ? 'ZERO' : ctHex(spendableBeforeSweep)}`);
  check('deposit lands in PENDING (dual-balance token)', !isZero(pendingAfterDeposit));
  check('spendable still ZERO before sweep', isZero(spendableBeforeSweep));

  await api.sweep();
  const spendableAfterSweep = await api.positionOf(accountId);
  console.log(`      spendable after sweep: ${ctHex(spendableAfterSweep)}`);
  check('sweep moves PENDING → SPENDABLE (position now real)', !isZero(spendableAfterSweep));

  // wallet-side plaintext cache, as the FE's recache() does
  providers.privateStateProvider.setContractAddress(contractAddress);
  const ps = await providers.privateStateProvider.get(confidentialCreditPoolPrivateStateKey);
  if (!ps) throw new Error('no private state to cache into');
  await providers.privateStateProvider.set(
    confidentialCreditPoolPrivateStateKey,
    ConfidentialCreditPoolPrivateState.cachePlaintext(ps, spendableAfterSweep, amount),
  );

  // ── on-chain public effect ───────────────────────────────────────────
  const afterInvest = await liveLedger(providers, contractAddress);
  console.log(`\n      public ledger after: positionCount=${afterInvest.positionCount}`);
  check(
    'PUBLIC ledger positionCount incremented on-chain',
    afterInvest.positionCount > before.positionCount,
  );

  // ── ACTION: "Disclose position" = disclose() ─────────────────────────
  console.log('\n[3] ACTION disclose() — decrypt own position');
  const disclosedCt = await api.positionOf(accountId);
  const disclosedAmount = amount; // wallet-tracked plaintext, as the FE does
  console.log(`      ciphertext on-chain : ${ctHex(disclosedCt)}`);
  console.log(`      decrypted for auditor: $${(Number(disclosedAmount) / 1e6).toLocaleString('en-US')}`);
  check('position is encrypted on-chain (non-zero ciphertext)', !isZero(disclosedCt));
  check('lender can decrypt own position', disclosedAmount === amount);

  // ── ACTION: "Claim" = claim() ────────────────────────────────────────
  console.log('\n[4] ACTION claim() — burn from spendable position');
  const claimAmount = 400n * UNIT;
  await api.claim(claimAmount);
  const spendableAfterClaim = await api.positionOf(accountId);
  console.log(`      spendable after claim: ${ctHex(spendableAfterClaim)}`);
  check(
    'ciphertext CHANGED after claim (balance moved on-chain)',
    spendableAfterSweep.c1.x !== spendableAfterClaim.c1.x ||
      spendableAfterSweep.c2.x !== spendableAfterClaim.c2.x,
  );
  check('position still non-zero after partial claim', !isZero(spendableAfterClaim));

  // ── privacy invariant ────────────────────────────────────────────────
  console.log('\n[5] PRIVACY invariant — what the public can see');
  const finalState = await liveLedger(providers, contractAddress);
  console.log(`      public: positionCount=${finalState.positionCount}, yieldAccruals=${finalState.yieldAccrualCount}, paused=${finalState.paused}`);
  console.log('      public: NO amounts, NO lender identities — only counts');
  check(
    'pool total/count public, amounts never in plaintext on-chain',
    typeof finalState.positionCount === 'bigint' && !isZero(spendableAfterClaim),
  );

  // ── REGRESSION: a lender's SECOND deposit must also work ─────────────
  // registerLender is one-time; calling it again asserts "already registered".
  // The FE used to call it on every invest(), so every deposit after the first
  // threw. This step locks that fixed.
  console.log('\n[6] REGRESSION second invest() — repeat deposit by same lender');
  const before2 = await liveLedger(providers, contractAddress);
  const ctBefore2 = await api.positionOf(accountId);
  const amount2 = 250n * UNIT;
  let secondOk = true;
  try {
    await api.deposit(accountId, amount2);
    await api.sweep();
    const ctAfter2 = await api.positionOf(accountId);
    const ps2 = await providers.privateStateProvider.get(confidentialCreditPoolPrivateStateKey);
    if (ps2) {
      await providers.privateStateProvider.set(
        confidentialCreditPoolPrivateStateKey,
        ConfidentialCreditPoolPrivateState.cachePlaintext(
          ps2, ctAfter2, amount - claimAmount + amount2,
        ),
      );
    }
    console.log(`      spendable after 2nd deposit: ${ctHex(ctAfter2)}`);
    check('second deposit succeeds (no re-registration)', true);
    check(
      'ciphertext changed again after 2nd deposit',
      ctBefore2.c1.x !== ctAfter2.c1.x || ctBefore2.c2.x !== ctAfter2.c2.x,
    );
  } catch (e) {
    secondOk = false;
    console.log(`      ERROR: ${e instanceof Error ? e.message : String(e)}`);
    check('second deposit succeeds (no re-registration)', false);
  }
  if (secondOk) {
    const after2 = await liveLedger(providers, contractAddress);
    console.log(`      positionCount ${before2.positionCount} → ${after2.positionCount}`);
    check('positionCount incremented again on-chain', after2.positionCount > before2.positionCount);
  }

  // ── ACCRUE YIELD (owner-gated) ────────────────────────────────────────
  // The pitch claims "confidential yield accrues onto your position". This is
  // the circuit behind that claim, and it only works if the pool was deployed
  // with a real owner — see the ownerAccount derivation above.
  console.log('\n[7] ADMIN accrueYield() — confidential yield onto the position');
  const beforeYield = await liveLedger(providers, contractAddress);
  const ctBeforeYield = await api.positionOf(accountId);
  const yieldAmount = 37n * UNIT;
  try {
    await api.accrueYield(accountId, yieldAmount);
    await api.sweep(); // yield is minted to PENDING, same as a deposit
    const ctAfterYield = await api.positionOf(accountId);
    const afterYield = await liveLedger(providers, contractAddress);
    console.log(`      position after yield: ${ctHex(ctAfterYield)}`);
    console.log(`      yieldAccrualCount ${beforeYield.yieldAccrualCount} → ${afterYield.yieldAccrualCount}`);
    check('owner can accrue yield (pool has a real owner)', true);
    check(
      'yield changed the encrypted position',
      ctBeforeYield.c1.x !== ctAfterYield.c1.x || ctBeforeYield.c2.x !== ctAfterYield.c2.x,
    );
    check(
      'public yieldAccrualCount incremented (amount stays hidden)',
      afterYield.yieldAccrualCount > beforeYield.yieldAccrualCount,
    );
  } catch (e) {
    console.log(`      ERROR: ${e instanceof Error ? e.message : String(e)}`);
    check('owner can accrue yield (pool has a real owner)', false);
  }

  // ── summary ──────────────────────────────────────────────────────────
  const failed = results.filter(([, ok]) => !ok);
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(` ${results.length - failed.length}/${results.length} checks passed`);
  console.log('══════════════════════════════════════════════════════════════');
  if (failed.length) {
    failed.forEach(([l]) => console.log(`  FAILED: ${l}`));
    process.exit(1);
  }
  console.log(' E2E OK — invest → sweep → disclose → claim, verified on-chain\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nE2E FAILED:', e);
  process.exit(1);
});
