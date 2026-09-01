// Request tNIGHT from the PREVIEW faucet for a given address.
//   npx tsx src/preview-fund-addr.ts <mn_addr_preview1...>
import { FaucetClient } from '@midnight-ntwrk/testkit-js';
import { createLogger } from './logger-utils.js';

const addr = process.argv[2];
if (!addr?.startsWith('mn_addr_preview1')) {
  console.error('need a preview address (mn_addr_preview1...)');
  process.exit(1);
}
const logger = await createLogger('/tmp/preview-faucet.log');
const faucet = new FaucetClient('https://midnight-tmnight-preview.nethermind.dev/', logger);
console.log('requesting tNIGHT for', addr);
const res = await faucet.requestTokens(addr);
console.log('FAUCET_RESULT:', JSON.stringify(res ?? 'ok'));
process.exit(0);
