/**
 * Local dev wallet client.
 *
 * Thin HTTP client for bboard-cli/src/dev-wallet-server.ts, which holds the
 * standalone chain's funded wallet and submits real ZK-proven transactions.
 * Returns the same { address, contractAddress, actions } shape as
 * connectAndResolvePool() in ./client.js, so every component that uses
 * `actions` works unchanged. Used while Lace can't pay fees on this stack.
 */
const BASE = import.meta.env.VITE_DEV_WALLET_URL;

async function call(path, body) {
  let res;
  try {
    res = await fetch(
      `${BASE}${path}`,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body, (_k, v) =>
              typeof v === "bigint" ? v.toString() : v,
            ),
          },
    );
  } catch {
    throw new Error(
      "Local dev wallet isn't running — start it with `npm run demo`.",
    );
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Dev wallet error (${res.status})`);
  return json;
}

export async function connectDevWallet() {
  if (!BASE) throw new Error("VITE_DEV_WALLET_URL is not set");

  const st = await call("/status");
  if (!st.ready) {
    throw new Error(
      st.error
        ? `Dev wallet failed to start: ${st.error}`
        : `Dev wallet is still starting (${st.phase}) — try again in a minute.`,
    );
  }

  let position = BigInt(st.position || "0");
  let accountId = st.accountId || null;
  const apply = (r) => {
    if (r.position != null) position = BigInt(r.position);
    if (r.accountId) accountId = r.accountId;
    return r;
  };

  const actions = {
    invest: async (amount) => apply(await call("/invest", { amount })),
    claim: async (amount) => apply(await call("/claim", { amount })),
    disclose: async () => {
      const r = apply(await call("/disclose", {}));
      return { ...r, amount: BigInt(r.amount) };
    },
    accrueYield: async (amount) =>
      apply(await call("/accrue-yield", { amount })),
    isOwner: () => Boolean(st.isOwner),
    position: () => position,
    accountId: () => accountId,
    state$: () => null,
  };

  return { address: st.address, contractAddress: st.contractAddress, actions };
}
