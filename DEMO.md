# Wave-1 demo — recording script (no Lace required)

~4 minutes. Everything shown is real and on-chain except where a beat says
otherwise. The portal's buttons sign with a **local dev wallet** — the standalone
chain's funded account, held by `bboard-cli/src/dev-wallet-server.ts` — because
Lace can't pay fees (DUST) on this stack yet. The transactions and ZK proofs are
real either way.

## Setup (before recording)

```bash
npm run demo        # stack + dev wallet + FE on :5201
```

If the stack is **already running** (portal on `:5201`, `curl -s localhost:5301/status`
shows `"ready":true`), skip this — `npm run demo` redeploys and costs several minutes.

Second terminal ready, sitting in `bboard-cli/`, with this typed but not run:

```bash
npx tsx src/e2e-ccp.ts
```

Checklist:
- [ ] `npm run demo` printed `dev wallet: http://127.0.0.1:5301` (sync + deploy takes a few minutes)
- [ ] `127.0.0.1:5201` loads the connect screen, with **Use local dev wallet** under Connect Lace
- [ ] **Use local dev wallet** reaches the dashboard (that is the signer for every action)
- [ ] "Browse pools without a wallet" opens the Pools grid read-only, for the look-around shot
- [ ] if the deploy step hangs: `cd bboard-cli && docker compose -f compose-standalone.yml down -v`, then `npm run demo` again
- [ ] close other Chrome tabs first — proofs stall when the Mac is out of memory
- [ ] `docker ps` shows node / indexer / proof-server
- [ ] terminal font large enough to read on video

---

## Beat 1 — the problem (25s)

Land on `127.0.0.1:5201`.

> "DeFa is invoice financing — lenders fund credit pools against real
> receivables. On a public chain that leaks the entire book: who lent, how much,
> to which borrower. That isn't a privacy nicety. It's why institutional lenders
> can't touch on-chain credit."

## Beat 2 — what we built (20s)

Point at the connect panel copy.

> "Wave 1 makes the lender side confidential on Midnight. Your deposit amount and
> your identity are ElGamal-encrypted on-chain. The pool's health stays public.
> And you can disclose your own position to an auditor without revealing anyone
> else's."

## Beat 3 — the product (35s)

Click **Browse pools without a wallet** (under Connect Lace) → the **Pools** grid.

> "Twelve pools across the lifecycle. Eleven are simulated portfolio context and
> badged Wave-2 — we label that rather than blur it."

Open the **● Live on Midnight** pool. Scroll the detail page: the info card, the
tab bar, My Position, the deposit rail.

> "One pool is wired to a live Midnight contract. This is the DeFa production
> interface — same components, same design system — with the data layer moved
> onto Midnight."

## Beat 3b — invest from the portal (90s) ← the centre of the video

On the live pool, click **Use local dev wallet** (My Position panel or the
deposit rail). Then, on camera:

1. Deposit rail → enter `1000` → **Deposit confidentially**. Each step
   (register → deposit → sweep) is a real ZK proof, so give it a minute or two;
   the success toast ends with the tx hash.
2. My Position → **Disclose** → the decrypted amount plus the on-chain ciphertext.
3. Admin yield box → `50` → **Accrue** → the position grows; only the public
   accrual count moves.
4. **Claim** `400` → the ciphertext changes on-chain.

> "Every click here is a real transaction on a Midnight node, with the
> zero-knowledge proof generated locally. The signer is the local chain's funded
> dev account — Lace can't pay fees on this stack yet — but the transactions,
> the proofs and the encrypted position are the real thing."

Tip: `tail -f bboard-cli/dev-wallet.log | grep --line-buffered -E "^  tx |READY"` prints each tx hash as it lands, without npm noise — a
split-screen of it next to the portal is the most convincing shot. Cut the
proof waits in editing.

## Beat 4 — the proof (60s)

Cut to the terminal. Run it.

```bash
npx tsx src/e2e-ccp.ts
```

While it runs:

> "Rather than click through a UI, here's the same action sequence the buttons
> call, run against a real chain, asserting on-chain state."

When the output lands, walk these lines specifically:

- `deposit lands in PENDING` / `spendable still ZERO before sweep`
  > "OpenZeppelin's confidential token is dual-balance — a deposit is credited to
  > a pending bucket, and the position genuinely reads zero until the holder
  > sweeps. That's why our lender flow is deposit, sweep, then claim."
- `PUBLIC ledger positionCount incremented on-chain`
  > "The public ledger learns a position was opened."
- `position is encrypted on-chain` / `lender can decrypt own position`
  > "But the amount is a ciphertext. Only the holder can decrypt it — that's the
  > disclosure primitive."
- `ciphertext CHANGED after claim`
  > "Claiming burns from the encrypted balance and the ciphertext moves on-chain."
- `public yieldAccrualCount incremented (amount stays hidden)`
  > "Yield accrues confidentially. The chain learns that an accrual happened,
  > never how much."

Finish on the summary:

> "Eighteen checks, all against real chain state — not against what a screen
> says."

## Beat 5 — honesty + Wave 2 (20s)

> "The confidential flow is real and verified on-chain today. The borrower side
> and the yield source are simulated in Wave 1, and the UI labels that
> everywhere. Wave 2 drives them from the live PayMate pipeline behind the same
> primitive."

---

## If asked why not Lace

Say it plainly — it's a stronger answer than a demo:

> "Connecting is free, but every transaction needs DUST, and DUST registration
> wasn't reachable in the Lace build we had. So we prove the flow the rigorous
> way: the test drives the identical action sequence the UI buttons call and
> asserts on the encrypted position and the public ledger. A screen recording
> can't prove what's on-chain. That test can."
