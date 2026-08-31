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

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(undefined);
    try {
      // The heavy Midnight SDK (+WASM, +Lace) is pulled in on demand so the
      // first paint of the app doesn't pay for it.
      const { connectAndResolvePool } = await import("./client");
      const res = await connectAndResolvePool();
      setAddress(res.address);
      setContractAddress(res.contractAddress);
      setActions(res.actions);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(() => {
    setActions(null);
    setAddress(undefined);
    setContractAddress(undefined);
    setStatus("idle");
    setError(undefined);
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
      refresh,
      version,
      isConnected: status === "connected",
      isConnecting: status === "connecting",
    }),
    [status, error, address, contractAddress, actions, connect, disconnect, refresh, version],
  );

  return (
    <MidnightContext.Provider value={value}>{children}</MidnightContext.Provider>
  );
}
