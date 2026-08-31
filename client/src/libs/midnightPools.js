/**
 * Maps frontend/data/simulated-pools.json into the "deal" shape the Arc UI
 * components (PoolWideCard, PoolInfoCard, PoolDetails, DepositForm) were
 * designed around.
 *
 * Bridge, not a rewrite — the same role libs/poolAdapter.js plays for the
 * payfi_v1 backend. The components are untouched; only their data source
 * changed. Exactly one pool (`ccp-live-01`) is wired to the live Midnight
 * contract; the other eleven are Wave-2 simulated borrowers and are labelled
 * as such wherever they render.
 */

import poolsJson from "../data/simulated-pools.json";

export const LIVE_POOL_ID = "ccp-live-01";

const rawPools = Array.isArray(poolsJson) ? poolsJson : poolsJson.pools || [];

// ── Formatters ─────────────────────────────────────────────────────

const usd = (n) =>
  `$ ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/**
 * Our lifecycle states are finer-grained than the Arc status tabs
 * (All / Open / Active / Settled). Map onto the raw status strings that
 * `statusFormater` in libs/utils already understands, so the existing tab
 * filtering keeps working untouched.
 */
const STATE_TO_STATUS = {
  Open: "lending", // → OPEN
  Funding: "lending", // → OPEN
  Funded: "closed", // → ACTIVE
  Repayment: "closed", // → ACTIVE
  Closed: "completed", // → SETTLED
  Unfunded: "unfulfilled", // → Unfulfilled
};

/** Risk tier A/B/C → the low/medium/high affordances baked into the UI. */
const TIER_TO_RISK = { A: "low", B: "medium", C: "high" };

const RISK_LABEL = { low: "Low", medium: "Medium", high: "High" };

// ── Main mapper ─────────────────────────────────────────────────────

export function mapPoolToDeal(pool) {
  if (!pool) return null;
  const risk = TIER_TO_RISK[pool.riskTier] || "medium";
  const raisedPct = pool.hardCap
    ? Math.round((pool.amountRaised / pool.hardCap) * 100)
    : 0;

  return {
    _id: pool.id,
    pubkey: pool.id,
    poolName: pool.name,
    status: STATE_TO_STATUS[pool.state] || "lending",
    poolRiskLevel: risk,
    date: `${pool.tenorDays}d tenor`,

    poolAmountRaised: pool.amountRaised,
    poolLenders: [],
    kyiScore: String(60 + Math.round(pool.apy)),
    isMatured: pool.state === "Closed",

    overview: {
      apyRate: `${pool.apy}%`,
      loanAmount: usd(pool.hardCap),
      loanTenure: `${pool.tenorDays} Days`,
      dealExpiresIn: pool.tenorDays,
      liquidityPool: `${RISK_LABEL[risk]} Risk Pool`,
    },

    business: {
      company: pool.borrower,
      sector: pool.sector,
      description: pool.privacyNote,
      jurisdiction: pool.currency,
    },

    tokenized: { statusDate: null },

    // ── DeFa × Midnight additions the Arc shape has no slot for ──
    isLive: !!pool.midnightWired,
    isSimulated: !!pool.simulated,
    badge: pool.midnightWired ? "● Live on Midnight" : "Simulated · Wave-2",
    privacyNote: pool.privacyNote,
    wave2Note: pool.wave2Note,
    apy: pool.apy,
    tenorDays: pool.tenorDays,
    hardCap: pool.hardCap,
    softCap: pool.softCap,
    amountRaised: pool.amountRaised,
    invoiceValue: pool.invoiceValue,
    riskTier: pool.riskTier,
    lifecycleState: pool.state,
    raisedPct,

    __raw: pool,
  };
}

// ── Accessors ───────────────────────────────────────────────────────

export const getDeals = () => rawPools.map(mapPoolToDeal);

export const getDealById = (id) => {
  const found = rawPools.find((p) => p.id === id);
  return found ? mapPoolToDeal(found) : null;
};

export const getLiveDeal = () => getDealById(LIVE_POOL_ID);
