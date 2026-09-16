# Wave-1 demo — recording script

**Angle:** privacy is not a feature here, it is the unlock. DeFa is a real
PayFi business; the reason institutional lenders can't fund on-chain credit is
that a public chain publishes the whole book. Wave 1 shows a lender funding a
live pool where the amount and the identity are encrypted on-chain — clicked
live, not narrated — and then shows that the chain itself holds only counts.

~4 minutes. Everything shown is real and on-chain except where a beat says
otherwise. The portal's buttons sign with a **local dev wallet** (the standalone
chain's funded account, held by `bboard-cli/src/dev-wallet-server.ts`) because
Lace can't pay fees (DUST) on this stack yet. The transactions and the ZK proofs
are real either way.

## Setup (before recording)

```bash
npm run demo        # stack + dev wallet + FE on :5201
```

If the stack is **already running** (portal on `:5201`, and
`curl -s localhost:5301/status` shows `"ready":true`), skip this — `npm run demo`
redeploys and costs several minutes.

Split-screen terminal, left of the browser:

```bash
tail -f bboard-cli/dev-wallet.log | grep --line-buffered -E "^  tx |READY"
```

Checklist:
- [ ] `curl -s localhost:5301/status` shows `"ready":true` and `"position":"0"`
- [ ] `127.0.0.1:5201` loads the connect screen with **Use local dev wallet**
- [ ] `docker ps` shows node / indexer / proof-server
- [ ] **Chrome quit and reopened with one tab** — proofs stall when the Mac runs out of memory
- [ ] terminal font large enough to read on video
- [ ] if a deploy hangs: `cd bboard-cli && docker compose -f compose-standalone.yml down -v`, then `npm run demo`

---

## Beat 1 — the problem (25s)

Land on `127.0.0.1:5201`.

> "DeFa finances real-world payment flow — lenders fund credit pools that
> prefund settlement for payment service providers. Put that on a public chain
> and you publish the entire book: who lent, how much, into which corridor.
> That's not a privacy nicety. It's why institutional lenders can't touch
> on-chain credit."

## Beat 2 — what we built (20s)

Point at the connect panel.

> "Wave 1 makes the lender side confidential on Midnight. Your deposit amount
> and your identity are ElGamal-encrypted on-chain. The pool's health stays
> public. And you can disclose your own position to an auditor without exposing
> anyone else's."

## Beat 3 — the product (30s)

Click **Use local dev wallet** → **Pools**.

> "This is the DeFa production lender interface — same components, same design
> system — with the data layer moved onto Midnight."

Open the **● Live on Midnight** pool: PSP Settlement Prefunding, 14-day cycle,
14.5% APY.

> "This pool is wired to a live Midnight contract. The rest are portfolio
> context for the borrower pipeline that lands in Wave 2, and they're labelled
> as simulated rather than blurred."

## Beat 4 — invest, live (90s) ← the centre of the video

Deposit rail → `1000` → **Deposit confidentially**.

> "One click, three transactions: register the lender, deposit, sweep. Each one
> generates a zero-knowledge proof locally before it's submitted."

Point at the split-screen log as the hashes land.

> "Those are real transaction hashes and block numbers on a Midnight node."

When the toast lands, show the position updating to $1,000.

Then **Disclose position**.

> "Here's the disclosure primitive. The number is mine, decrypted with my
> viewing key. Underneath it is what's actually stored on-chain — the
> ciphertext. Nobody else can read that, and I can hand this view to an auditor
> without touching anyone else's position."

Admin box → `50` → **Accrue**.

> "Yield accrues onto the position, encrypted. In Wave 1 this stands in for a
> PSP settlement repayment — the UI says so."

Claim `400`.

> "And the lender withdraws. The ciphertext changes on-chain; the amount never
> appears."

## Beat 5 — what the public actually sees (20s) ← the privacy payoff

Cut to the terminal:

```bash
curl -s localhost:5301/status | python3 -c "import json,sys; d=json.load(sys.stdin); print('PUBLIC LEDGER:', json.dumps(d['ledger']))"
```

> "That's the entire public state of the pool after everything you just watched.
> How many positions exist, how many accruals happened. No amounts, no
> identities, no lender list. The chain enforces that — it isn't a UI that hides
> columns."

## Beat 6 — honesty + the waves (25s)

> "What's real today: the confidential deposit, the position, the disclosure,
> the yield accrual and the claim, all on-chain, covered by eighteen automated
> checks against real chain state. What's simulated: the borrower side — the PSP
> repayment that produces the yield — and the other pools' portfolio data.
> Wave 2 drives the yield from the live PayMate settlement pipeline behind this
> same primitive. Wave 3 opens it to many pools and many lenders."

---

## Optional tail — the automated proof (20s, if the cut has room)

```bash
npx tsx src/e2e-ccp.ts        # deploys its own pool; ~7 min, so pre-record it
```

Flash the summary only:

```
 18/18 checks passed
 E2E OK — invest → sweep → disclose → claim, verified on-chain
```

> "Eighteen checks against real chain state — not against what a screen says."

## If asked why not Lace

> "Lace connects, but every transaction needs DUST for fees and DUST
> registration wasn't reachable in the Lace build we had. So the portal signs
> with the local chain's funded account instead. The Lace path is still wired;
> the transactions, the proofs and the encrypted positions you saw are identical
> either way."
