// Create a THROWAWAY preview wallet we control, faucet it, and register its
// NIGHT for DUST generation — then print the seed so it can be imported into
// Lace for a live wallet-connect demo.
//
// This exists because DUST registration ("Generate tDUST") wasn't reachable in
// the Lace build on hand. Doing it programmatically here and handing over the
// seed gets a funded, DUST-registered wallet into Lace.
//
// Testnet only. Throwaway. Never reuse this seed for anything real.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { PreviewRemoteConfig } from './config.js';
import { createLogger } from './logger-utils.js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { waitForUnshieldedFunds, getInitialUnshieldedState } from './wallet-utils';
import { generateDust } from './generate-dust';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';

// @ts-expect-error apollo needs a global WebSocket
globalThis.WebSocket = WebSocket;

const SEED_FILE = '/tmp/preview-demo-wallet-seed.txt';
const seed = existsSync(SEED_FILE)
  ? readFileSync(SEED_FILE, 'utf8').trim()
  : (() => { const s = randomBytes(32).toString('hex'); writeFileSync(SEED_FILE, s); return s; })();

const config = new PreviewRemoteConfig();
const logger = await createLogger(config.logDir);
const env = await config.getEnvironment(logger).start();

const wp = await MidnightWalletProvider.build(logger, env, seed);
await wp.start();

const pre = await getInitialUnshieldedState(logger, wp.wallet.unshielded);
const addr = UnshieldedAddress.codec.encode(getNetworkId(), pre.address).toString();
console.log('DEMO_WALLET_ADDRESS:', addr);
console.log('DEMO_WALLET_SEED   :', seed);

console.log('requesting faucet + waiting for NIGHT...');
const funded = await waitForUnshieldedFunds(logger, wp.wallet, env, unshieldedToken(), true);
const night = funded.balances[unshieldedToken().raw] ?? 0n;
console.log('NIGHT_BALANCE:', String(night));

if (night > 0n) {
  console.log('registering NIGHT for DUST generation...');
  await generateDust(logger, seed, funded, wp.wallet);
  console.log('DUST_REGISTERED');
}
console.log('DONE');
process.exit(0);
