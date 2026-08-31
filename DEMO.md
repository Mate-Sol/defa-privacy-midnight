# Wave-1 demo — recording script

Everything below is real on-chain unless a beat says otherwise. Total runtime ~3 min.

## Before you hit record

```bash
npm run demo          # compiles if needed, starts stack, deploys, wires FE, serves :5201
```

Then in Lace: network **Undeployed/Custom** → node `http://127.0.0.1:9944`,
indexer `http://127.0.0.1:8088`, proof server `http://127.0.0.1:6300`. Unlock it.

Checklist:
- [ ] `docker ps` shows node / indexer / proof-server up
- [ ] `client/.env.local` holds the address `npm run demo` printed
- [ ] Lace unlocked, on the local network
- [ ] Second terminal ready with the E2E command (beat 6)
- [ ] Chain state persists across Docker restarts now — but don't restart mid-take

> **The admin yield control only appears if this wallet deployed the pool.**
> `npm run demo` deploys from the CLI wallet, so the button is hidden in the UI.
> To show yield on camera, either clear `client/.env.local` before connecting
> (the FE then deploys its own pool and you are the owner), or run beat 5 from
> the terminal instead.

---

## Beat 1 — the problem (20s)

Land on `127.0.0.1:5201`. Connect screen.

> "DeFa is invoice financing. On a public chain, funding a pool leaks the whole
> book — who lent, how much, to which borrower. That's not a privacy nicety,
> it's why institutional lenders can't use it."

## Beat 2 — connect (15s)

Click **Connect Lace** → approve.

> "There's no account and no backend here. The wallet is the session."

Lands on the dashboard.

## Beat 3 — the pool (25s)

**Pools** → point at the badges.

> "Eleven of these are simulated portfolio context, badged Wave-2. Exactly one
> is live on Midnight."

Open the **● Live on Midnight** pool.

## Beat 4 — confidential deposit (45s) ← the core

Right rail, enter `1000`, click **Deposit confidentially**. Sign in Lace.

> "That's three circuits behind one button: register, deposit, sweep. The token
> is dual-balance — a deposit lands in a pending bucket, and the position reads
> zero until you sweep it into spendable. Both balances are ElGamal-encrypted."

Wait for the toast.

## Beat 5 — yield (20s, optional — see note above)

Admin panel → enter `37` → **Accrue**.

> "Wave-1 simulates the borrower repayment. The yield is minted encrypted onto
> the position — the public ledger only learns that an accrual happened, never
> how much."

## Beat 6 — the privacy claim, proven (30s) ← the money shot

**My Position** → **Disclose position**.

> "Decrypted locally with my viewing key. I can show an auditor exactly my own
> stake — and nothing about anyone else's."

Cut to the terminal:

```bash
cd bboard-cli && npx tsx src/e2e-ccp.ts
```

> "Eighteen checks against the real chain. Note this one: the position count is
> public, the amounts never are. That's the whole thesis in one assertion."

## Beat 7 — claim + honesty (25s)

Enter an amount → **Claim**.

> "Burns from the encrypted position; the ciphertext changes on-chain."

Close on the Wave-1 note:

> "The confidential flow is real and on-chain today. The borrower side and the
> yield source are simulated, and we label that everywhere rather than blur it.
> Wave-2 wires the live PayMate pipeline behind the same primitive."

---

## If something breaks on camera

| Symptom | Cause | Fix |
|---|---|---|
| "Could not find a compatible Midnight Lace wallet" | extension not injecting / wrong apiVersion | reload the page with Lace unlocked |
| Deposit fails on fees | wallet has no NIGHT on this net | genesis funds the CLI wallet, not Lace — fund yours first |
| "already registered" | shouldn't happen — `resolveAccountId` handles it | reload; the accountId is recovered via `sweep()` |
| "ElGamal: plaintext mismatch" on claim | tracked balance lost | it's persisted per contract+wallet; a different wallet or contract resets it |
| Everything 404s | dev server serving a stale path | re-run `npm run demo` |
