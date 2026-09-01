// Browser shim for `pino`.
//
// @midnight-ntwrk/midnight-js-types depends on pino, and Vite resolves its NODE
// build, which touches process.stderr/stdout/hrtime. `process` doesn't exist in
// the browser, so connecting the wallet threw "process is not defined". Nothing
// in the browser path needs real structured logging — the SDK only ever calls
// logger.info/trace/etc — so map it onto console.
const mk = () => {
  const l = {
    info: (...a) => console.info('[midnight]', ...a),
    trace: (...a) => console.debug('[midnight]', ...a),
    debug: (...a) => console.debug('[midnight]', ...a),
    warn: (...a) => console.warn('[midnight]', ...a),
    error: (...a) => console.error('[midnight]', ...a),
    fatal: (...a) => console.error('[midnight]', ...a),
    silent: () => {},
    level: 'info',
  };
  l.child = () => mk();
  return l;
};
const pino = () => mk();
pino.destination = () => ({});
pino.transport = () => ({});
pino.stdSerializers = {};
pino.levels = { values: {}, labels: {} };
export default pino;
export { pino };
