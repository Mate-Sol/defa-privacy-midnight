import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingOverlay from "@/components/loading/LoadingOverlay";
import Button from "@/components/ui/Button";
import Typography from "@/components/ui/Typography";
import yieldHand from "../assets/multiChain-ui/yieldHand.svg";
import leftCoin from "../assets/multiChain-ui/left-defa-coin.svg";
import rightCoin from "../assets/multiChain-ui/right-defa-coin.svg";
import mainLogo from "../assets/multiChain-ui/main-defa-logo.svg";
import { useMidnight } from "@/midnight/context";

/**
 * Connect screen.
 *
 * Same brand treatment as the Arc login (logo, coins, yield-hand artwork), but
 * the email/password form is gone: there is no backend to authenticate against
 * and no account to hold. Connecting the Midnight Lace wallet IS the session —
 * see src/midnight/context.jsx and components/navigation/AuthProtection.jsx.
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const { connect, status, error, isConnected, isConnecting } = useMidnight();

  useEffect(() => {
    if (isConnected) navigate("/dashboard");
  }, [isConnected, navigate]);

  const connectPanel = (
    <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-8 md:px-10 lg:px-16 z-10 py-10 lg:py-0 min-h-screen lg:min-h-0">
      <div className="w-full max-w-[380px] sm:max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 sm:mb-10">
          <img
            src={mainLogo}
            alt="DeFa Logo"
            className="h-8 sm:h-9 md:h-10 w-auto"
          />
        </div>

        {/* Heading */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-[26px] sm:text-[28px] font-semibold text-white mb-1">
            Connect Wallet
          </h1>
          <p className="text-white/90 text-[14px] sm:text-[15px] font-normal">
            Lend confidentially on Midnight. Your wallet is your session.
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-1">
            <Typography
              as="label"
              variant="body2"
              className="text-white font-medium"
            >
              Midnight Lace
            </Typography>
            <p className="text-white/70 text-[13px] leading-relaxed">
              Your deposit amount and identity are ElGamal-encrypted on-chain.
              Only the pool total and position count are public — never who, or
              how much.
            </p>
          </div>

          <Button
            type="button"
            variant="gradient"
            color="primary"
            onClick={() => void connect()}
            disabled={isConnecting}
            className="w-full h-[46px] sm:h-[50px] text-[14px] sm:text-[15px] mt-2 !bg-blue-500/50"
          >
            {isConnecting ? "Connecting…" : "Connect Lace"}
          </Button>

          {status === "error" && error && (
            <p className="text-red-400 text-[12px] pl-1 leading-relaxed">
              {error}
            </p>
          )}
        </div>

        {/* Wave-1 honesty note */}
        <div className="text-center pt-4">
          <p className="text-white/80 text-[12px] sm:text-[13px] font-normal leading-relaxed">
            Wave-1: the confidential flow is real on Midnight. Borrower
            repayments are simulated and labelled.
          </p>
        </div>
      </div>
    </div>
  );

  const rightSection = (
    <div className="hidden lg:block lg:w-1/2 relative">
      <div className="absolute left-[5%] top-[15%] z-20">
        <img
          src={leftCoin}
          alt="Defa Coin"
          className="w-[80px] xl:w-[100px] h-auto"
        />
      </div>
      <div className="absolute right-[10%] bottom-[28%] z-20">
        <img
          src={rightCoin}
          alt="Defa Coin"
          className="w-[90px] xl:w-[110px] h-auto"
        />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 w-[420px] xl:w-[520px] 2xl:w-[580px]">
        <img
          src={yieldHand}
          alt="Yield Time"
          className="w-full h-auto object-contain object-bottom"
          style={{ maxHeight: "95vh" }}
        />
      </div>
    </div>
  );

  const mobileCoins = (
    <div className="lg:hidden absolute inset-0 pointer-events-none overflow-hidden">
      <img
        src={leftCoin}
        alt=""
        className="absolute top-4 right-4 w-12 sm:w-14 opacity-40"
      />
      <img
        src={rightCoin}
        alt=""
        className="absolute bottom-6 left-4 w-12 sm:w-14 opacity-40"
      />
    </div>
  );

  return (
    <>
      <LoadingOverlay isLoading={isConnecting} status="Connecting Lace…" />
      <div className="relative min-h-screen w-full flex flex-col lg:flex-row overflow-hidden">
        {mobileCoins}
        {connectPanel}
        {rightSection}
      </div>
    </>
  );
};

export default LoginPage;
