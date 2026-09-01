# Prompt: clone an existing FE and rewire it to a new backend

Paste the block below into a fresh Claude Code session, filling in the four
`<>` placeholders. It encodes the method that worked here, including the
decisions that mattered and the traps that cost time.

---

You are porting an existing frontend onto a different backend. The look must be
preserved **exactly** — this is a clone with the data layer swapped, not a
rebuild.

- SOURCE FE: `<git url or path>` — the app whose UI we are keeping
- TARGET REPO: `<path>` — where the ported app will live
- NEW BACKEND: `<what the actions must call instead>`
- SCOPE: `<which pages; say "all" if the whole app>`

## The core rule

Do NOT recreate, rewrite, or "clean up" the source UI. Copy the actual files and
change only the data layer and the actions. If you find yourself authoring new
JSX for a page that already exists in the source, stop and copy theirs instead.
A previous attempt at this rebuilt the FE from brand colours alone and it looked
generic and wrong.

## Order of work

**1. Clone and RUN the source first.** Do not start porting from reading code.
Install it, run it, open it in a real browser, and look at every page in scope.
If it is auth-gated and the backend is dead, add a temporary env-gated bypass in
the *reference clone only* so you can see the pages — never in the target repo.

**2. Audit before touching anything.** Produce a table mapping each in-scope page
to the exact files that back it: page, components, data source, and which
backend calls it makes. Note dead code (unrouted pages, stub components) so you
do not port it.

**3. Settle the stack question before writing code.** If the source and target
use different frameworks, say so explicitly and get a decision. Porting across
frameworks (router, CSS engine, file extensions, env vars) touches every copied
file, and every touch is a chance for visual drift. Taking the SOURCE app as the
base and grafting the new wiring into it is usually the better trade — it makes
the clone pixel-exact by construction and often deletes a whole class of build
problems. Do not assume; ask.

**4. Copy wholesale, then restore.** `rsync -a --exclude node_modules --exclude
.git source/ target/`. Then restore from the source's git HEAD any file you
patched locally (e.g. the auth bypass), and verify with grep that none of it
leaked in.

**5. Swap the data layer with an ADAPTER, not by editing components.** Find the
object shape the components already consume (`deal`, `item`, whatever) by
reading the card/detail components. Write one module that maps your new data
into that exact shape — including formatted strings if the components render raw
values. If the source repo already has such an adapter for its own backend,
mirror its structure and say so in a comment. Components stay untouched.

**6. Swap auth mechanism, keep the auth SHAPE.** If the source gates on a
backend JWT and you have a wallet/SSO/other, replace the check inside the
existing guard component and keep its markup, spinner, and redirects. Same for
the login page: keep the layout and artwork, repoint the button.

**7. Trim routes; do not delete pages.** Out-of-scope pages stay on disk,
unrouted and absent from nav. Deleting them causes needless diff and you may
want them next phase. Leave a comment saying why.

**8. Verify like you mean it.**
- `npm run build` must exit 0
- lint must exit 0 — but do NOT "fix" style errors inside verbatim-cloned files;
  scope those rules off for that directory and hold your own code to the full
  ruleset. Rewriting cloned files to satisfy lint reintroduces drift.
- write an end-to-end test that drives the SAME action sequence the UI buttons
  call, asserting against real backend state, not UI state
- then clone the repo fresh into a temp dir and run install → build → test.
  This catches gitignored build artifacts that only exist on your machine.

## Traps that cost time here

- **Dev servers binding IPv6 only.** `curl` succeeded while the browser showed an
  error page. Bind explicitly to `127.0.0.1`.
- **Gitignored build artifacts.** A script that copies compiler output works
  locally and fails for everyone else. Check the source of every copy step is
  actually committed; if not, fail with the command to regenerate it.
- **Stale scripts after a rename.** Renaming the app directory breaks paths in
  sibling tooling. Grep for the old name across the repo.
- **Owner/admin defaults.** If the backend has owner-gated operations and the
  deploy path omits the owner, those operations may be permanently uncallable.
  Check what the default actually is.
- **One-time registration calls.** If an action registers an identity, calling it
  unconditionally breaks every attempt after the first. Detect-or-recover.
- **Client-side state that must survive reload.** Anything the client tracks that
  cannot be re-read from the backend must be persisted, or returning users break.
- **Colours.** Components you author yourself will drift from the palette unless
  you use the theme tokens. Read the theme file and use its tokens, never
  arbitrary framework colours.

## Reporting

Say plainly what is real vs simulated, what is verified vs merely built, and what
you could not test. Do not describe something as working because it compiles.
