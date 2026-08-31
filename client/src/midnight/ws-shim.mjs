// Browser shim for `isomorphic-ws`/`ws`: expose the native WebSocket in the
// shapes the Midnight indexer provider imports (named + default + .WebSocket).
const WS = typeof globalThis !== 'undefined' ? globalThis.WebSocket : undefined;
export { WS as WebSocket };
export default WS;
