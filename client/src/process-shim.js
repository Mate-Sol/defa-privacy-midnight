// Minimal `process` global for the browser.
//
// Several transitive deps of the Midnight SDK (notably `debug`, reached via
// midnight-js-*) resolve to their NODE builds under Vite and touch
// process.stderr / process.stdout / process.env. In the browser `process` is
// undefined, so the first wallet connect threw "process is not defined".
//
// Aliasing each offender individually is whack-a-mole; defining the global once,
// before any other import, covers the class. Values are inert stubs: nothing in
// the browser path should be writing to stdio anyway.
if (typeof globalThis.process === "undefined") {
  globalThis.process = {
    env: {},
    argv: [],
    platform: "browser",
    version: "",
    versions: {},
    stderr: { isTTY: false, write: () => {} },
    stdout: { isTTY: false, write: () => {} },
    nextTick: (fn, ...a) => queueMicrotask(() => fn(...a)),
    hrtime: Object.assign(() => [0, 0], { bigint: () => 0n }),
    emit: () => {},
    on: () => {},
    off: () => {},
    emitWarning: () => {},
    cwd: () => "/",
    exit: () => {},
  };
}
