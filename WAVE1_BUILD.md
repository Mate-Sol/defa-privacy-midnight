# DeFa × Midnight — Wave-1 Build Status & Manifest

Confidential Credit Pools on Midnight. Privacy flow (deposit → private position →
confidential yield → claim → disclose) is REAL on-chain; borrower side + yield
source are SIMULATED and labelled (Wave-2 = PayMate pipeline).

## ✅ DONE & VERIFIED

### Phase 1 — API layer (`api/`)
Forked the bboard-api into a **ConfidentialCreditPoolAPI**. Typechecks + builds clean.
- `contract/src/index.ts` — exports compiled artifacts + witnesses; `CompiledConfidentialCreditPoolContract` (CompiledContract.make + witnesses factory + managed assets).
- `api/src/common-types.ts` — `ConfidentialCreditPool{Contract,Providers,CircuitKeys,DerivedState}`, private-state key `confidentialCreditPoolPrivateState`.
- `api/src/index.ts` — `ConfidentialCreditPoolAPI` with `deploy`/`join` (constructor args `[name,symbol,decimals,ownerAccount]` via `args:[…]`), typed circuit wrappers (`registerLender`/`deposit`/`claim`/`accrueYield`/`positionOf`/`isLenderRegistered`/`pause`/`unpause`, circuit results read from `txData.private.result`), and a `state$` observable of the PUBLIC ledger (owner/paused/positionCount/yieldAccrualCount/poolInitialized).
- Verify: `cd api && npm run typecheck && npm run build` → clean.
- NOTE: api `package.json` still named `@midnight-ntwrk/bboard-api` (kept so workspace imports resolve); `main` field points at `./dist/index.js` but build emits `./dist/api/src/index.js` — FE should import from source (`../../api/src/index`) like the CLI does, or fix `main`.

### Phase 2 — Local standalone deploy + FULL confidential round-trip (`bboard-cli/src/deploy-ccp.ts`)
Non-interactive deploy to the **local standalone network** (genesis-funded, NO DUST needed). PROVEN end-to-end:
```
DEPLOYED ConfidentialCreditPool at: f863a35b9bab41f1fb1755f6a5dd81d6c0917ae0b84a090e3588fb66cb641a8f
registerLender -> accountId: f591f59974ab9e8085bfde615758e64a2eff8d665228b833419b7951d514c88d
deposit(1_000_000) -> credited to PENDING
BEFORE sweep: positionOf ZERO | pendingOf NON-ZERO
sweep()       -> pending rolled into spendable
AFTER sweep:  positionOf NON-ZERO  (deposit now reflected)
claim(400_000)-> burned from spendable
AFTER claim:  positionOf NON-ZERO, ciphertext CHANGED (balance decreased)
ASSERT positionOf non-zero after sweep: PASS
ASSERT positionOf ciphertext changed after claim: PASS
ROUND-TRIP OK: deploy → register → deposit → sweep → positionOf(real) → claim
```
- Reproduce: `cd bboard-cli && npx tsx src/deploy-ccp.ts` (needs Docker; testkit spins node+indexer+proof-server; genesis seed `0x…01`).
- Gotchas baked in: `privateStoragePasswordProvider` must return ≥16 chars; `zkConfigPath` → `contract/src/managed/ConfidentialCreditPool`; `npx tsx` (NOT ts-node — Node 24 breaks the esm loader).

### Phase 1b — positionOf zero-ciphertext FIXED (the USP de-risk)
Root cause (confirmed in vendored `contract/src/oz/token/ConfidentialFungibleToken.compact`): OZ CFT is a **dual-balance** token. `_mint`→`_credit` lands value in a **`_pending`** map (anti-grief: only the holder can move it); `balanceOf`(=`positionOf`) reads the **`_balances`** (spendable) map, so it's zero until the holder rolls pending→spendable via **`sweep()`**. `_burn`(=`claim`) debits spendable and calls `wit_PlaintextBalance(ct)` to build the burn proof.
- **Fix (does NOT change the privacy model** — both balances are ElGamal-encrypted; only the deposit/sweep *event* is observable, same as the already-public positionCount):
  - Added `sweep()` + `pendingOf()` circuits to `ConfidentialCreditPool.compact` (recompiled → **10 circuits**).
  - Added `sweep`/`pendingOf` wrappers to the API.
  - Lender flow is now **deposit → sweep → positionOf(real) → claim**.
  - `claim`/`_debit` requires the wallet to cache the plaintext of its current spendable ciphertext (standard CFT bookkeeping): `ConfidentialCreditPoolPrivateState.cachePlaintext(ps, ciphertext, amount)` then `privateStateProvider.set(...)`. The FE wallet MUST do this after each balance change (see deploy-ccp.ts for the exact pattern).

### Phase 3 — Data (started)
- `frontend/data/simulated-pools.json` — 12 pools across all lifecycle states (Open/Funding/Funded/Repayment/Closed/Unfunded), DeFa/PayMate/CredMate flavored, clearly labelled simulated. Exactly ONE (`ccp-live-01`, `midnightWired:true`) is the pool wired to the live Midnight contract; the rest are portfolio dressing.

### Phase 3 + 4 — FE: DONE, builds CLEAN ✅
Option A shipped: fresh **Next.js 15 + React 19 + Tailwind** app in `frontend/`, DeFa brand theme, with bboard-ui's Midnight browser wiring ported to `ConfidentialCreditPoolAPI`.
- **`npm run build` → clean (exit 0)**, 19 routes (6 pages + 12 SSG pool detail pages). Only a benign warning (ledger WASM async/await false-positive).
- **6 pages:** landing (`app/page.tsx`), dashboard shell+nav (`app/dashboard/layout.tsx` + `Sidebar`), dashboard home (stat tiles + inline-SVG chart + featured live pool), pool list (state-filter tabs), pool detail (`[id]`, SSG), invest console.
- **LIVE on Midnight (real):** the `ccp-live-01` pool → `PoolActions` widget wires **invest = register→deposit→sweep** (+ plaintext cache), **claim**, and **Disclose** (decrypt own position) to `ConfidentialCreditPoolAPI` via Lace. Wiring in `lib/midnight/{context.tsx,client.ts}` — all `@midnight-ntwrk/*`/WASM is client-only (`await import()` inside the connect handler, never SSR).
- **SIMULATED (labelled):** the other 11 pools render from `data/simulated-pools.json`; every card/detail shows a "Simulated · Wave-2" tag; the live pool shows "● Live on Midnight".
- **Build config that made it work** (`frontend/next.config.js`): `experiments.asyncWebAssembly + topLevelAwait`; `resolve.extensionAlias` `.js`→`.ts` (NodeNext specifiers); `isomorphic-ws`/`ws` aliased to a native-WebSocket shim (`lib/midnight/ws-shim.mjs`); node builtins stubbed in the browser. Also made `contract/src/witnesses.ts` browser-safe (Web Crypto `globalThis.crypto` instead of `node:crypto`/`Buffer`).
- **Run the demo:** `cd frontend && npm run build && npm start` (or `npm run dev`). Needs the **Lace** wallet on the target network; set `NEXT_PUBLIC_NETWORK_ID` (e.g. `undeployed` for standalone) and optionally `NEXT_PUBLIC_CCP_CONTRACT_ADDRESS` to join an existing pool instead of deploying a fresh one on connect. ZK keys/zkir are served from `frontend/public/{keys,zkir}`.

## Historical: FE approach decision (resolved → Option A above)

**Neither existing FE is a fast clean-build**, and this is a real fork:
- **Arbitrum FE** (`~/defa-arbitrum-openhouse/frontend`, Next.js + Tailwind + Radix + Redux): the RIGHT DeFa look, but NOT Midnight-wired (thirdweb/Soroban/Cosmos), huge, and its pages call an external InvoiceMate API (`/marketPlaces`, `/lender`) that isn't in the repo → breaks the build until every data call is repointed/stubbed.
- **bboard-ui** (`~/defa-privacy-midnight/bboard-ui`, Vite + React + **MUI**): already Midnight-wired (Lace connect, `DeployedBoardProvider`/`BrowserDeployedBoardManager`, deploy/join, `state$`) and it's the proven browser-wiring pattern — but MUI, off-brand, and its `BBoardAPI` import now needs swapping to `ConfidentialCreditPoolAPI`. `node_modules` not installed.

**RECOMMENDATION (combines right look + proven wiring):** build `frontend/` as a fresh **Next.js + Tailwind** app using the DeFa theme tokens (`frontend/lib/defa-theme.ts`, extracted from the Arbitrum FE), and **port bboard-ui's Midnight provider/wiring layer** (`contexts/BrowserDeployedBoardManager.ts` + `hooks` + Lace connector) swapping `BBoardAPI` → `ConfidentialCreditPoolAPI`. Then build the 6 page shells (data from Midnight `state$` + `simulated-pools.json`). Wire deposit as **deposit → sweep** (two-tx, mirrors lender-deposit.jsx approve→participate), claim → `claim` (with the plaintext-cache step from Phase-1b), and add the **Disclose** action (decrypt own position via `positionOf` + the wallet's plaintext cache) in the pool-detail claim region.
- Build-risk to watch: Midnight browser SDK pulls WASM + Lace wallet APIs — keep all `@midnight-ntwrk/*` wallet/provider code in **client-only** modules (`'use client'`, dynamic import, `ssr:false`) or Next SSR will choke. This is the main reason a clean `npm run build` needs a careful pass, not a wholesale copy.

Port these 6 shells + theme from the Arbitrum FE; STRIP borrower/admin/Soroban/Cosmos/thirdweb-facility:

| Port | From (Arbitrum) | Action |
|---|---|---|
| Landing | `app/page.jsx` (+ otp-input, feature-pill) | reuse, drop OTP gate |
| Dashboard shell | `app/dashboard/layout.jsx` + `components/sidebar-navigation.jsx` | reuse, trim nav, strip CopilotKit |
| Dashboard home | `app/dashboard/page.jsx` + `sections/Dashboard/wide-stats-cards.jsx` + `apexs-charts*.jsx` | reuse, repoint data → Midnight + simulated-pools |
| Pool list | `app/dashboard/pool/page.jsx` + `sections/Pool/pool-wide-card.jsx` | reuse, source from simulated-pools.json |
| Pool detail | `pool/[id]/page.jsx` + `sections/Pool/PoolDetails.jsx` | reuse layout + claim-button slots; rip out Soroban/Cosmos/PSP |
| Invest | `app/dashboard/invest/page.jsx` + `components/lender-deposit.jsx` | **primary wire target** |
| Theme/ui | `tailwind.config.js`, `components/ui/*`, brand palette `#4E31FA/#A44BF7/#0F5DF7` | reuse as-is |

**Phase 4 wiring:** model the deposit on `lender-deposit.jsx` (amount→units, approve→participate state machine) but call the Midnight API: `registerLender → deposit`; claim → `claim`; add a NET-NEW **Disclose** action in the claim-button region of `PoolDetails` (decrypt own position via viewing key / plaintext cache). Browser providers + Lace wallet: copy the pattern from `bboard-ui/src/` (DeployedBoardContext/BrowserDeployedBoardManager, in-memory/level private-state provider) but swap `BBoardAPI` → `ConfidentialCreditPoolAPI`. Real reads: `positionCount`, my position; simulated: the 11 other pools.

**Preprod (explorer links):** blocked on DUST on the user's machine (Lace + faucet + ~12h init). Local standalone is the demo path; preprod deploy = same `ConfidentialCreditPoolAPI.deploy` with the preprod config once DUST lands.
