// Copy the compiled ZK artifacts (proving/verifying keys + zkir) into public/
// so FetchZkConfigProvider can serve them from the app origin.
//
// These are compiler OUTPUT, not source: `managed/` is gitignored repo-wide, so
// a fresh clone has to compile the contract first. Fail loudly with the actual
// command rather than letting `cp` emit "No such file or directory".
import { cp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const managed = path.resolve(
  here, '..', '..', 'contract', 'src', 'managed', 'ConfidentialCreditPool',
);

const exists = async (p) => {
  try { await access(p); return true; } catch { return false; }
};

if (!(await exists(managed))) {
  console.error(`
  ZK artifacts not found:
    ${managed}

  These are Compact compiler output and are gitignored, so a fresh clone has to
  build the contract first:

    cd contract && npm run compact

  (needs compactc 0.31.0 on PATH — see WAVE1_BUILD.md)
`);
  process.exit(1);
}

for (const dir of ['keys', 'zkir']) {
  const src = path.join(managed, dir);
  if (!(await exists(src))) {
    console.error(`  Missing ${dir}/ under ${managed} — recompile the contract.`);
    process.exit(1);
  }
  const dest = path.resolve(here, '..', 'public', dir);
  await rm(dest, { recursive: true, force: true });
  await cp(src, dest, { recursive: true });
  console.log(`  synced ${dir}/ -> public/${dir}/`);
}
