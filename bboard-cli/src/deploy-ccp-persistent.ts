// DeFa × Midnight — deploy ConfidentialCreditPool against the PERSISTENT local
// standalone stack (compose-standalone.yml), so the contract survives the
// process and the browser FE can join it.
//
// deploy-ccp.ts spins its own testkit environment on random ports and ryuk tears
// it down on exit — great for a CLI round-trip, useless for a browser test.
// This targets the fixed-port stack instead.
//
//   docker compose -f compose-standalone.yml up -d
//   npx tsx src/deploy-ccp-persistent.ts
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';
import { WebSocket } from 'ws';
import pino from 'pino';
import {
  ConfidentialCreditPoolAPI,
  type ConfidentialCreditPoolProviders,
  type PrivateStateId,
} from '../../api/src/index';
import { ConfidentialCreditPoolPrivateState } from '../../contract/src/witnesses.js';
import { persistentHash, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { waitForUnshieldedFunds } from './wallet-utils';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

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

async function main(): Promise<void> {
  const logger = pino({ level: 'info' });
  setNetworkId('undeployed' as Parameters<typeof setNetworkId>[0]);

  const zkConfigPath = path.resolve(
    here, '..', '..', 'contract', 'src', 'managed', 'ConfidentialCreditPool',
  );

  logger.info(`Targeting persistent standalone stack: ${JSON.stringify(ENV)}`);

  const walletProvider = await MidnightWalletProvider.build(
    logger, ENV, GENESIS_MINT_WALLET_SEED,
  );
  await walletProvider.start();

  const unshielded = await waitForUnshieldedFunds(
    logger, walletProvider.wallet, ENV, unshieldedToken(),
  );
  logger.info(`NIGHT balance: ${unshielded.balances[unshieldedToken().raw]}`);

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const providers: ConfidentialCreditPoolProviders = {
    privateStateProvider: levelPrivateStateProvider<PrivateStateId>({
      privateStateStoreName: 'ccp-persistent-private-state',
      signingKeyStoreName: 'ccp-persistent-private-state-signing-keys',
      privateStoragePasswordProvider: () => 'DeFa-Ccp-Standalone-Test-2026!',
      accountId: GENESIS_MINT_WALLET_SEED,
    }),
    publicDataProvider: indexerPublicDataProvider(ENV.indexer, ENV.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(ENV.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  // The owner-gated circuits (accrueYield / pause / unpause) compare the
  // caller's derived accountId to the on-chain `owner`. Deploying without an
  // ownerAccount defaults it to 32 zero bytes, which NO wallet can ever derive
  // — permanently bricking all three. accountId is persistentHash(sk) and is
  // pure, so derive it from the private state we're about to deploy with.
  const initialPrivateState = ConfidentialCreditPoolPrivateState.generate();
  const ownerAccount = persistentHash(
    new CompactTypeBytes(32),
    initialPrivateState.secretKey,
  );
  logger.info(`owner accountId: ${toHex(ownerAccount)}`);

  logger.info('Deploying ConfidentialCreditPool...');
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

  console.log(`\n=== DEPLOYED ConfidentialCreditPool at: ${api.deployedContractAddress} ===\n`);
  console.log('This contract PERSISTS — the stack stays up until you run:');
  console.log('  docker compose -f compose-standalone.yml down -v\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('DEPLOY FAILED:', e);
  process.exit(1);
});
