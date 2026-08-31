// DeFa × Midnight — non-interactive ConfidentialCreditPool deploy + round-trip
// against the LOCAL STANDALONE network (genesis-funded, no DUST/faucet needed).
//
// Proves: deploy → registerLender → deposit → positionOf → isLenderRegistered.
// Run with: npx tsx src/deploy-ccp.ts
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';
import { WebSocket } from 'ws';
import pino from 'pino';
import {
  ConfidentialCreditPoolAPI,
  type ConfidentialCreditPoolProviders,
  type PrivateStateId,
  confidentialCreditPoolPrivateStateKey,
} from '../../api/src/index';
import { ConfidentialCreditPoolPrivateState } from '../../contract/src/witnesses.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { StandaloneConfig } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { waitForUnshieldedFunds } from './wallet-utils';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const GENESIS_MINT_WALLET_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

const here = path.resolve(new URL(import.meta.url).pathname, '..');

async function main(): Promise<void> {
  const logger = pino({ level: 'info' });

  const config = new StandaloneConfig();
  // Point the ZK config at OUR compiled contract, not bboard.
  config.zkConfigPath = path.resolve(
    here,
    '..',
    '..',
    'contract',
    'src',
    'managed',
    'ConfidentialCreditPool',
  );
  config.privateStateStoreName = 'ccp-private-state';

  logger.info('Starting standalone test environment (node + indexer)...');
  const testEnv = config.getEnvironment(logger);
  const envConfiguration = await testEnv.start();
  logger.info(`Environment up: ${JSON.stringify(envConfiguration)}`);

  const seed = GENESIS_MINT_WALLET_SEED;
  const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
  await walletProvider.start();

  const unshieldedState = await waitForUnshieldedFunds(
    logger,
    walletProvider.wallet,
    envConfiguration,
    unshieldedToken(),
  );
  logger.info(`NIGHT balance: ${unshieldedState.balances[unshieldedToken().raw]}`);

  const zkConfigProvider = new NodeZkConfigProvider(config.zkConfigPath);
  const providers: ConfidentialCreditPoolProviders = {
    privateStateProvider: levelPrivateStateProvider<PrivateStateId>({
      privateStateStoreName: config.privateStateStoreName,
      signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
      privateStoragePasswordProvider: () => 'DeFa-Ccp-Standalone-Test-2026!',
      accountId: seed,
    }),
    publicDataProvider: indexerPublicDataProvider(
      envConfiguration.indexer,
      envConfiguration.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  logger.info('Deploying ConfidentialCreditPool...');
  const api = await ConfidentialCreditPoolAPI.deploy(
    providers,
    {
      name: 'DeFa Confidential Position',
      symbol: 'dLP',
      decimals: 6n,
      initialPrivateState: ConfidentialCreditPoolPrivateState.generate(),
    },
    logger,
  );
  console.log(`\n=== DEPLOYED ConfidentialCreditPool at: ${api.deployedContractAddress} ===\n`);

  // A ciphertext is the ElGamal "encryptZero" (identity, identity) iff both
  // points are the identity — whose x-coordinate is 0. A real encrypted value
  // has a non-zero x with overwhelming probability. This lets us PROVE the
  // deposited amount lands in the spendable position after sweep, without
  // decrypting (amounts stay hidden on-chain).
  const isZero = (ct: { c1: { x: bigint }; c2: { x: bigint } }): boolean =>
    ct.c1.x === 0n && ct.c2.x === 0n;
  const show = (label: string, ct: { c1: { x: bigint }; c2: { x: bigint } }): void =>
    console.log(
      `  ${label}: ${isZero(ct) ? 'ZERO (encryptZero — empty)' : `NON-ZERO encrypted [c1.x=${ct.c1.x.toString(16).slice(0, 10)}…]`}`,
    );

  const accountId = await api.registerLender();
  console.log(`registerLender -> accountId: ${toHex(accountId)}`);

  await api.deposit(accountId, 1_000_000n);
  console.log(`deposit(accountId, 1_000_000) -> credited to PENDING`);
  console.log(`isLenderRegistered(accountId): ${await api.isLenderRegistered(accountId)}`);

  console.log('\n-- BEFORE sweep --');
  show('positionOf (spendable)', await api.positionOf(accountId));
  show('pendingOf  (incoming) ', await api.pendingOf(accountId));

  await api.sweep();
  console.log('\nsweep() -> rolled PENDING into SPENDABLE');
  console.log('-- AFTER sweep --');
  const spendableAfter = await api.positionOf(accountId);
  show('positionOf (spendable)', spendableAfter);
  show('pendingOf  (incoming) ', await api.pendingOf(accountId));

  // Confidential-token wallet bookkeeping: to build the burn proof, `_debit`
  // calls wit_PlaintextBalance(currentSpendableCiphertext) and ZK-verifies it
  // decrypts to that value. The wallet KNOWS its spendable balance is 1,000,000
  // (it deposited + swept it), so we cache {spendableCiphertext -> 1_000_000}
  // in the private state before claiming. (The FE wallet must do the same after
  // each balance change — this is standard CFT plaintext tracking, not a
  // privacy-model change: the amount is known only to the holder.)
  providers.privateStateProvider.setContractAddress(api.deployedContractAddress);
  const ps = await providers.privateStateProvider.get(confidentialCreditPoolPrivateStateKey);
  if (!ps) throw new Error('no private state to cache into');
  const psCached = ConfidentialCreditPoolPrivateState.cachePlaintext(ps, spendableAfter, 1_000_000n);
  await providers.privateStateProvider.set(confidentialCreditPoolPrivateStateKey, psCached);
  console.log('\ncached spendable plaintext (1_000_000) for burn proof');

  await api.claim(400_000n);
  console.log('claim(400_000) -> burned from spendable position');
  console.log('-- AFTER claim --');
  const spendableAfterClaim = await api.positionOf(accountId);
  show('positionOf (spendable)', spendableAfterClaim);

  // Assert the privacy USP actually works: spendable is non-zero after sweep,
  // and the ciphertext changes after a partial claim (balance decreased).
  const okAfterSweep = !isZero(spendableAfter);
  const okChangedOnClaim =
    spendableAfter.c1.x !== spendableAfterClaim.c1.x ||
    spendableAfter.c2.x !== spendableAfterClaim.c2.x;
  console.log(
    `\nASSERT positionOf non-zero after sweep: ${okAfterSweep ? 'PASS' : 'FAIL'}`,
  );
  console.log(
    `ASSERT positionOf ciphertext changed after claim: ${okChangedOnClaim ? 'PASS' : 'FAIL'}`,
  );

  if (okAfterSweep && okChangedOnClaim) {
    console.log(
      '\n=== ROUND-TRIP OK: deploy → register → deposit → sweep → positionOf(real) → claim ===',
    );
    process.exit(0);
  } else {
    console.log('\n=== ROUND-TRIP FAILED: positionOf did not reflect the deposit ===');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('DEPLOY FAILED:', e);
  process.exit(1);
});
