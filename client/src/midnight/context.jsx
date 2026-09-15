import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * Midnight/Lace connection context.
 *
 * This replaces the Arc backend login gate: a connected Lace wallet IS the
 * session. `status === "connected"` is what AuthProtection now checks, and the
 * confidential lender actions (invest / claim / disclose) hang off `actions`.
 */
const MidnightContext = createContext(null);

export function useMidnight() {
  const ctx = useContext(MidnightContext);
  if (!ctx) throw new Error("useMidnight must be used within <MidnightProvider>");
  return ctx;
}

export function MidnightProvider({ children }) {
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | error
  const [error, setError] = useState(undefined);
  const [address, setAddress] = useState(undefined);
  const [contractAddress, setContractAddress] = useState(undefined);
  const [actions, setActions] = useState(null);
  // Bumped after every state-changing action so views re-read the position.
  const [version, setVersion] = useState(0);
  // Read-only browsing without Lace: pools and pool detail render, but every
  // confidential action still requires a connected wallet (they gate on
  // `isConnected && actions`). Kept per-tab so a refresh doesn't bounce.
  const [viewOnly, setViewOnly] = useState(() => {
    try {
      return sessionStorage.getItem("defa:viewOnly") === "1";
    } catch {
      return false;
    }
  });

  const browse = useCallback(() => {
    try {
      sessionStorage.setItem("defa:viewOnly", "1");
    } catch {
      // storage blocked (private mode etc.) — in-memory flag still works
    }
    setViewOnly(true);
  }, []);

  const [walletKind, setWalletKind] = useState(null); // "lace" | "dev"

  const connectWith = useCallback(async (kind) => {
    setStatus("connecting");
    setError(undefined);
    try {
      // The heavy Midnight SDK (+WASM, +Lace) is pulled in on demand so the
      // first paint of the app doesn't pay for it. The dev wallet is a thin
      // HTTP client for bboard-cli/src/dev-wallet-server.ts.
      const res =
        kind === "dev"
          ? await (await import("./dev-wallet")).connectDevWallet()
          : await (await import("./client")).connectAndResolvePool();
      setAddress(res.address);
      setContractAddress(res.contractAddress);
      setActions(res.actions);
      setWalletKind(kind);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, []);

  const connect = useCallback(() => connectWith("lace"), [connectWith]);
  const connectDev = useCallback(() => connectWith("dev"), [connectWith]);

  const disconnect = useCallback(() => {
    setActions(null);
    setAddress(undefined);
    setContractAddress(undefined);
    setWalletKind(null);
    setStatus("idle");
    setError(undefined);
    try {
      sessionStorage.removeItem("defa:viewOnly");
    } catch {
      // storage blocked — nothing to clear
    }
    setViewOnly(false);
  }, []);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({
      status,
      error,
      address,
      contractAddress,
      actions,
      connect,
      disconnect,
      browse,
      viewOnly,
      connectDev,
      isDevWallet: walletKind === "dev",
      hasDevWallet: Boolean(import.meta.env.VITE_DEV_WALLET_URL),
      refresh,
      version,
      isConnected: status === "connected",
      isConnecting: status === "connecting",
    }),
    [status, error, address, contractAddress, actions, connect, connectDev, walletKind, disconnect, browse, viewOnly, refresh, version],
  );

  return (
    <MidnightContext.Provider value={value}>{children}</MidnightContext.Provider>
  );
}
