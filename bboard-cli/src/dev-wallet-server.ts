// Local dev wallet for the Wave-1 lender portal.
//
// Lace can't pay fees on this stack yet (DUST registration wasn't reachable),
// so the portal's Invest / Claim / Disclose / Yield buttons had nothing to sign
// with. This process holds the standalone chain's pre-funded genesis wallet,
// deploys a pool it owns, and runs the SAME action sequence as
// client/src/midnight/client.js and e2e-ccp.ts — real ZK proofs, real
// transactions on the local Midnight node. The portal calls it over HTTP.
//
// Local dev only: binds 127.0.0.1, standalone network, genesis seed.
//
//   npx tsx src/dev-wallet-server.ts        (npm run demo starts it)
// SPDX-License-Identifier: Apache-2.0

import http from 'node:http';
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

const PORT = 5301;
const GENESIS_MINT_WALLET_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';
const here = path.resolve(new URL(import.meta.url).pathname, '..');

// Fixed ports from compose-standalone.yml.
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

type TxRecord = { circuit: string; txHash: string; blockHeight: string | null; at: string };
type TxData = { public: { txHash: unknown; blockHeight?: unknown } };
type Ct = { c1: { x: bigint }; c2: { x: bigint } };

let phase: 'starting' | 'syncing wallet' | 'deploying pool' | 'ready' | 'error' = 'starting';
let startError: string | null = null;
let walletProvider: MidnightWalletProvider;
let providers: ConfidentialCreditPoolProviders;
let api: ConfidentialCreditPoolAPI;
let contractAddress = '';
let accountId: Uint8Array | null = null;
// Spendable plaintext the wallet tracks for its own position — ElGamal can't be
// decrypted back from the chain, and claim's burn proof checks Dec(ct)==this.
let tracked = 0n;
const txs: TxRecord[] = [];

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const ctHex = (ct: Ct): string => `${ct.c1.x.toString(16)}:${ct.c2.x.toString(16)}`;

const record = (circuit: string, d: TxData): TxRecord => {
  const r: TxRecord = {
    circuit,
    txHash: String(d.public.txHash),
    blockHeight: d.public.blockHeight == null ? null : String(d.public.blockHeight),
    at: new Date().toISOString(),
  };
  txs.unshift(r);
  txs.length = Math.min(txs.length, 50);
  console.log(`  tx ${circuit.padEnd(14)} ${r.txHash}${r.blockHeight ? `  @ block ${r.blockHeight}` : ''}`);
  return r;
};

const snapshot = () => ({
  accountId: accountId ? toHex(accountId) : null,
  position: tracked.toString(),
});

async function init(): Promise<void> {
  const logger = pino({ level: 'warn' });
  setNetworkId('undeployed' as Parameters<typeof setNetworkId>[0]);

  phase = 'syncing wallet';
  console.log('Syncing the genesis dev wallet…');
  walletProvider = await MidnightWalletProvider.build(logger, ENV, GENESIS_MINT_WALLET_SEED);
  await walletProvider.start();
  await waitForUnshieldedFunds(logger, walletProvider.wallet, ENV, unshieldedToken());

  const zkConfigProvider = new NodeZkConfigProvider(
    path.resolve(here, '..', '..', 'contract', 'src', 'managed', 'ConfidentialCreditPool'),
  );
  providers = {
    privateStateProvider: levelPrivateStateProvider<PrivateStateId>({
      privateStateStoreName: 'ccp-devwallet-private-state',
      signingKeyStoreName: 'ccp-devwallet-private-state-signing-keys',
      privateStoragePasswordProvider: () => 'DeFa-Ccp-Standalone-Test-2026!',
      accountId: GENESIS_MINT_WALLET_SEED,
    }),
    publicDataProvider: indexerPublicDataProvider(ENV.indexer, ENV.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(ENV.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  // Deploy with a real owner so the owner-gated accrueYield works — same
  // derivation as deploy-ccp-persistent.ts (accountId = persistentHash(sk)).
  phase = 'deploying pool';
  console.log('Deploying a pool owned by the dev wallet…');
  const initialPrivateState = PS.generate();
  const ownerAccount = persistentHash(new CompactTypeBytes(32), initialPrivateState.secretKey);
  api = await ConfidentialCreditPoolAPI.deploy(
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
  contractAddress = api.deployedContractAddress;

  fs.writeFileSync(
    path.resolve(here, '..', '..', 'client', '.env.local'),
    `VITE_NETWORK_ID=undeployed\nVITE_CCP_CONTRACT_ADDRESS=${contractAddress}\nVITE_DEV_WALLET_URL=http://127.0.0.1:${PORT}\n`,
  );

  phase = 'ready';
  console.log(`\nREADY  pool ${contractAddress}`);
  console.log('       portal: http://127.0.0.1:5201 → "Use local dev wallet"\n');
}

async function recache(): Promise<void> {
  if (!accountId) return;
  providers.privateStateProvider.setContractAddress(contractAddress);
  const ps = await providers.privateStateProvider.get(confidentialCreditPoolPrivateStateKey);
  if (!ps) return;
  const ct = await api.positionOf(accountId);
  await providers.privateStateProvider.set(
    confidentialCreditPoolPrivateStateKey,
    PS.cachePlaintext(ps, ct, tracked),
  );
}

// registerLender is one-time; an already-registered lender recovers the
// accountId from sweep()'s return value (mirrors client.js).
async function resolveAccountId(steps: TxRecord[]): Promise<Uint8Array> {
  if (accountId) return accountId;
  const c = api.deployedContract.callTx;
  try {
    const d = await c.registerLender();
    steps.push(record('registerLender', d));
    accountId = d.private.result;
  } catch (e) {
    if (!/already registered/i.test(errMsg(e))) throw e;
    const d = await c.sweep();
    steps.push(record('sweep', d));
    accountId = d.private.result;
  }
  return accountId as Uint8Array;
}

const actions = {
  async invest(amount: bigint) {
    const steps: TxRecord[] = [];
    const acct = await resolveAccountId(steps);
    const c = api.deployedContract.callTx;
    steps.push(record('deposit', await c.deposit(acct, amount)));
    // Dual-balance token: deposit lands in PENDING until swept to SPENDABLE.
    steps.push(record('sweep', await c.sweep()));
    tracked += amount;
    await recache();
    return { ...snapshot(), steps };
  },
  async claim(amount: bigint) {
    if (!accountId) throw new Error('No position yet — invest first.');
    if (amount > tracked) throw new Error('Claim exceeds your position.');
    const steps = [record('claim', await api.deployedContract.callTx.claim(amount))];
    tracked -= amount;
    await recache();
    return { ...snapshot(), steps };
  },
  async disclose() {
    if (!accountId) throw new Error('No position yet — invest first.');
    const ct = await api.positionOf(accountId);
    return { ...snapshot(), amount: tracked.toString(), ciphertextHex: ctHex(ct) };
  },
  async accrueYield(amount: bigint) {
    if (!accountId) throw new Error('No position yet — invest first.');
    const c = api.deployedContract.callTx;
    const steps = [record('accrueYield', await c.accrueYield(accountId, amount))];
    steps.push(record('sweep', await c.sweep())); // yield lands in PENDING too
    tracked += amount;
    await recache();
    return { ...snapshot(), steps };
  },
};

// One wallet can't build two transactions at once — run actions in order.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function toAmount(v: unknown): bigint {
  let n: bigint;
  try {
    n = BigInt(String(v));
  } catch {
    throw new Error('amount must be an integer in 6-decimal units');
  }
  if (n <= 0n) throw new Error('amount must be positive');
  return n;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  const url = (req.url ?? '').split('?')[0];
  try {
    if (req.method === 'GET' && url === '/status') {
      const base = {
        ready: phase === 'ready',
        phase,
        error: startError,
        contractAddress: contractAddress || null,
        isOwner: phase === 'ready',
        ...snapshot(),
        txs,
      };
      if (phase !== 'ready') return send(res, 200, base);
      let ledger = null;
      try {
        const st = await providers.publicDataProvider.queryContractState(contractAddress);
        if (st) {
          const l = CCP.ledger(st.data);
          ledger = { positionCount: l.positionCount, yieldAccrualCount: l.yieldAccrualCount };
        }
      } catch {
        ledger = null;
      }
      return send(res, 200, { ...base, address: String(walletProvider.getCoinPublicKey()), ledger });
    }

    if (req.method !== 'POST') return send(res, 404, { error: 'not found' });
    if (phase !== 'ready') {
      return send(res, 503, { error: `Dev wallet is still starting (${phase})` });
    }
    const body = await readBody(req);
    switch (url) {
      case '/invest': {
        const amount = toAmount(body.amount);
        return send(res, 200, await serial(() => actions.invest(amount)));
      }
      case '/claim': {
        const amount = toAmount(body.amount);
        return send(res, 200, await serial(() => actions.claim(amount)));
      }
      case '/disclose':
        return send(res, 200, await serial(() => actions.disclose()));
      case '/accrue-yield': {
        const amount = toAmount(body.amount);
        return send(res, 200, await serial(() => actions.accrueYield(amount)));
      }
      default:
        return send(res, 404, { error: 'not found' });
    }
  } catch (e) {
    console.error(`  ✗ ${url}: ${errMsg(e)}`);
    return send(res, 500, { error: errMsg(e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Dev wallet listening on http://127.0.0.1:${PORT}`);
});

init().catch((e) => {
  phase = 'error';
  startError = errMsg(e);
  console.error(`Dev wallet failed to start: ${startError}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => process.exit(0));
}
