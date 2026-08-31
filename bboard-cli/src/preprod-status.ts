// Preprod wallet status — read-only.
//
// Loads the EXISTING seed from ~/defa-midnight/.preprod-wallet-seed (never
// prints it, never writes it — the template's get-address.ts generates a NEW
// seed and overwrites that file, which would strand anything already funded)
// and reports the fundable address plus NIGHT/DUST balances.
//
//   npx tsx src/preprod-status.ts
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { PreprodRemoteConfig } from './config.js';
import { createLogger } from './logger-utils.js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { getInitialUnshieldedState } from './wallet-utils';
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
console.log(`seed loaded from ${SEED_PATH} (${seed.length} hex chars) — not printed`);

const wp = await MidnightWalletProvider.build(logger, env, seed);
await wp.start();

const st = await getInitialUnshieldedState(logger, wp.wallet.unshielded);
const addr = UnshieldedAddress.codec.encode(getNetworkId(), st.address).toString();
const night = st.balances[unshieldedToken().raw] ?? 0n;

console.log('\n════════════════════════════════════════');
console.log('FUNDABLE_ADDRESS:', addr);
console.log('NIGHT_BALANCE   :', String(night));
console.log('FAUCET_ENDPOINT :', env.faucet ?? '(none configured)');
console.log('════════════════════════════════════════\n');
process.exit(0);
