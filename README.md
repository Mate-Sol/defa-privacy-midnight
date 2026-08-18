# DeFa × Midnight — Confidential Credit

Private, composable credit positions on [Midnight](https://midnight.network). Built for the AKINDO WaveHack.

DeFa is an invoice-financing marketplace: lenders fund credit pools, borrowers draw liquidity against verified invoices, repayments settle back to lenders. On public chains this leaks the whole book — borrower identity, invoice amounts, lender allocations, business relationships. **Midnight lets those stay private on-chain while settlement stays auditable.** That is the entire point of this project.

## Waves plan

One project, refined across three waves (WaveHack iterates the same build; each wave rewards progress).

| Wave | Theme | Deliverable |
|------|-------|-------------|
| **1** | Confidential credit primitive | Lender privately deposits into a DeFa credit pool → receives a **private position**. Amount + identity hidden, pool total public, one-click auditor disclosure. Full React FE. |
| **2** | PayMate full flow | Real end-to-end capital cycle: deposit → pool funds a borrower → repayment → lender claim, confidential throughout. |
| **3** | Multi-pool / multi-lender | Many lenders, many pools, per-lender private positions, aggregate public analytics. |

### What Wave 1 outputs, in prod-DeFa terms
The **confidential capital-in / private-position-out primitive** — the exact lender-privacy layer prod DeFa (Starknet-mainnet invoice financing) plugs in. It delivers the funding + position half of the DeFa loop, made confidential (hidden amount/identity, public pool total, `disclose()` for audit). The SME-verify → score → borrower-payout → repay → claim lifecycle is Wave 2/3.

## Architecture (Compact)

Midnight's model maps directly onto confidential credit:

- **Ledger** (public on-chain state) → pool total, pool status
- **Witness** (private off-chain state) → lender identity, individual amounts
- **`disclose()`** → native selective disclosure for auditors/regulators
- **OZ `ConfidentialFungibleToken`** → shielded position/deposit token (private balances + holders)
- **OZ `Ownable` / `Pausable`** → admin controls, mirroring the DeFa marketplace

> **Design note — no C2C yet.** Midnight does not (currently) support contract-to-contract token movement: a contract that *receives* an external token cannot send it back out. So the pool is modelled as a **token issuer** — it *mints* a confidential position token to the lender against a deposit (mint/burn + escrow), rather than custodying an external token. This shapes the whole contract design.

## Toolchain (verified working)

| Tool | Version | Notes |
|------|---------|-------|
| Compact compiler | **0.31.0** (pinned) | Newer compilers (0.33 → language 0.25) break the templates/OZ. Pin with `compact update 0.31.0`. |
| OpenZeppelin Compact | v0.2.0 (npm) / v0.3.0-alpha (GitHub) | `ConfidentialFungibleToken` is only in the GitHub alpha — vendored, not on npm yet. |
| Proof server | Docker (`localhost:6300`) | Generates ZK proofs; required by CLI + UI. |
| Wallet | Lace (Midnight network) | Fund via faucet: tNIGHT → generate tDUST for fees. |
| Node | 24.x | |

## Layout

```
contract/         Compact smart contract + TS bindings (bboard base → ConfidentialCreditPool)
api/              contract API layer
bboard-cli/       deploy/interact CLI (base → defa-cli)
bboard-ui/        React UI (base → defa-ui)
contract-probes/  stack-gate experiments (MiniPool.compact — OZ import + compile proof)
```

## Status

- ✅ **Stack gate (compile):** Compact 0.31 installed; bboard template compiles; OZ modules (Ownable + Pausable + FungibleToken) import and compile to ZK artifacts (see `contract-probes/MiniPool.compact`).
- ⏳ **Stack gate (deploy):** pending Lace wallet + tDUST, then testnet deploy.
- ⬜ Wave 1 `ConfidentialCreditPool` contract + FE.

---

Scaffolded from [midnightntwrk/example-bboard](https://github.com/midnightntwrk/example-bboard) (Apache-2.0, see `LICENSE`).
