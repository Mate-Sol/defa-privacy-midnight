// Fund the preprod wallet from the faucet, then register NIGHT for DUST
// generation so the wallet can pay fees.
//
// Uses the SDK's FaucetClient (the captcha lives only on the faucet's web UI;
// the programmatic endpoint is the intended dev path). Reuses the EXISTING seed
// — never generates or overwrites one.
//
//   npx tsx src/preprod-fund.ts
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { PreprodRemoteConfig } from './config.js';
import { createLogger } from './logger-utils.js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { waitForUnshieldedFunds, getInitialUnshieldedState } from './wallet-utils';
import { generateDust } from './generate-dust';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';

// @ts-expect-error apollo needs a global WebSocket
globalThis.WebSocket = WebSocket;

const SEED_PATH = path.join(os.homedir(), 'defa-midnight', '.preprod-wallet-seed');

const config = new PreprodRemoteConfig();
const logger = await createLogger(config.logDir);
const env = await config.getEnvironment(logger).start();

const seed = readFileSync(SEED_PATH, 'utf8').trim();
const wp = await MidnightWalletProvider.build(logger, env, seed);
await wp.start();

const pre = await getInitialUnshieldedState(logger, wp.wallet.unshielded);
console.log(
  'ADDRESS:',
  UnshieldedAddress.codec.encode(getNetworkId(), pre.address).toString(),
);

// fundFromFaucet=true → FaucetClient.requestTokens(), then block until NIGHT lands
console.log('Requesting tNIGHT from the faucet and waiting for it to land...');
const funded = await waitForUnshieldedFunds(
  logger,
  wp.wallet,
  env,
  unshieldedToken(),
  true,
);
const night = funded.balances[unshieldedToken().raw] ?? 0n;
console.log('NIGHT_BALANCE:', String(night));

if (night > 0n) {
  console.log('Registering NIGHT for DUST generation...');
  await generateDust(logger, seed, funded, wp.wallet);
  console.log('DUST_REGISTERED — generation accrues from here');
}
console.log('DONE');
process.exit(0);
