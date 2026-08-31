import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMidnight } from "@/midnight/context";
import mainLogo from "@/assets/multiChain-ui/main-defa-logo.svg";

/**
 * Session gate.
 *
 * The Arc build gated on a backend-issued JWT (`/users/get-user/:id`). Here the
 * Midnight Lace wallet IS the session: a connected wallet is a logged-in
 * lender, because every confidential action (invest / claim / disclose) is
 * authorised by that wallet's keys rather than by a server. Same brand
 * treatment, no backend.
 */
const AuthProtection = ({ children }) => {
  const navigate = useNavigate();
  const { isConnected, isConnecting } = useMidnight();

  useEffect(() => {
    // Not connected and not mid-connect → back to the connect screen.
    if (!isConnected && !isConnecting) navigate("/");
  }, [isConnected, isConnecting, navigate]);

  if (!isConnected)
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 z-50 bg-overlay">
        <img src={mainLogo} alt="DeFa Logo" className="h-9 w-auto opacity-90" />
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-accent animate-spin" />
          <p className="text-white/70 text-sm tracking-wide">
            {isConnecting ? "Connecting Lace…" : "Please Wait..."}
          </p>
        </div>
      </div>
    );

  return <>{children}</>;
};

export default AuthProtection;
