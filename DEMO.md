# Wave-1 demo — recording script (no wallet required)

~3 minutes. Everything shown is real and on-chain except where a beat says
otherwise. The Lace click-through is deliberately NOT in this cut: connecting is
free but every transaction needs DUST, and DUST registration was not reachable
in the Lace build we had on the day. Nothing about the proof depends on it.

## Setup (before recording)

```bash
npm run demo        # stack + deploy + FE on :5201
```

Second terminal ready, sitting in `bboard-cli/`, with this typed but not run:

```bash
npx tsx src/e2e-ccp.ts
```

Checklist:
- [ ] `127.0.0.1:5201` loads the connect screen
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

Walk **Pools** → the grid.

> "Twelve pools across the lifecycle. Eleven are simulated portfolio context and
> badged Wave-2 — we label that rather than blur it."

Open the **● Live on Midnight** pool. Scroll the detail page: the info card, the
tab bar, My Position, the deposit rail.

> "One pool is wired to a live Midnight contract. This is the DeFa production
> interface — same components, same design system — with the data layer moved
> onto Midnight."

## Beat 4 — the proof (60s) ← the centre of the video

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

## If asked why no wallet click-through

Say it plainly — it's a stronger answer than a demo:

> "Connecting is free, but every transaction needs DUST, and DUST registration
> wasn't reachable in the Lace build we had. So we prove the flow the rigorous
> way: the test drives the identical action sequence the UI buttons call and
> asserts on the encrypted position and the public ledger. A screen recording
> can't prove what's on-chain. That test can."
