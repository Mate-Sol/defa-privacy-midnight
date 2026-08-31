import React, { useState } from "react";
import Button from "../components/ui/Button";
import { Zap } from "lucide-react";
import { toast } from "react-toastify";
import { useMidnight } from "@/midnight/context";

/**
 * Deposit form (Midnight-wired).
 *
 * Same form, same two-step signing rhythm the Arc build had — only the steps
 * changed. Where Arc signed `approve` then `deposit` against an EVM pool, this
 * runs the confidential sequence against the Midnight contract:
 *
 *  1. If Lace not connected → show a Connect button.
 *  2. registerLender()  — mint the lender an ElGamal encryption key.
 *  3. deposit(amount)   — value lands in the token's PENDING bucket.
 *  4. sweep()           — roll pending → spendable so positionOf reflects it.
 *
 * Steps 2–4 are one `actions.invest(units)` call. The sweep is not optional:
 * OZ's ConfidentialFungibleToken is dual-balance, and positionOf reads the
 * spendable side.
 *
 * The `deal` prop comes from libs/midnightPools — `deal.isLive` marks the one
 * pool wired to the live contract.
 */
const UNIT = 1_000_000; // dLP position token, 6 decimals

const DepositForm = ({ walletBalance, currency = "USDC", apy = "12.00", deal }) => {
  const { address, isConnected, actions, connect, isConnecting, refresh } =
    useMidnight();

  const [usdcAmount, setUsdcAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maxBalance = parseFloat(String(walletBalance || "0").replace(/,/g, "")) || 0;
  const apyRate = parseFloat(apy) / 100;
  const parsedAmount = parseFloat(usdcAmount) || 0;
  const projectedEarnings = (parsedAmount * apyRate).toFixed(2);

  const handleChange = (e) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) setUsdcAmount(val);
  };
  const handleMax = () => setUsdcAmount(maxBalance.toString());

  const handleSubmit = async () => {
    try {
      if (!isConnected || !address || !actions) {
        toast.error("Connect your Lace wallet first");
        return;
      }
      if (parsedAmount <= 0) {
        toast.warning(`Enter a positive ${currency} amount`);
        return;
      }
      if (!deal?.isLive) {
        toast.info(
          "This pool is a Wave-2 simulated borrower. Deposit into the Midnight-wired pool to invest confidentially.",
        );
        return;
      }

      setSubmitting(true);
      toast.info("Registering lender — sign in Lace");
      const { accountId } = await actions.invest(
        BigInt(Math.round(parsedAmount * UNIT)),
      );
      toast.success(
        `Deposited ${parsedAmount} confidentially → position ${accountId.slice(0, 10)}…`,
      );
      setUsdcAmount("");
      refresh();
    } catch (error) {
      console.log("🚀 ~ handleSubmit ~ error:", error);
      const reason = error?.message || "Deposit failed";
      toast.error(reason);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col  gap-3">
      {/* Main Card */}
      <div className="rounded-2xl bg-primary-card/40 backdrop-blur-md border border-white/20 p-5 flex flex-col gap-4 shadow-lg">
        {/* Title + Balance */}
        <div className="flex flex-col gap-0.5">
          <span className="text-white/60 text-xs">Deposit {currency}</span>
          <span className="text-white font-bold text-2xl leading-tight">
            {walletBalance} {currency}
          </span>
        </div>

        {/* Input row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-white text-sm shrink-0">$99.99k</span>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="text"
              value={usdcAmount}
              onChange={handleChange}
              placeholder={`0.27 ${currency}`}
              className="bg-transparent text-white/70 text-sm text-right outline-none w-24 placeholder-white/40"
            />
            <button
              onClick={handleMax}
              className="border border-white/40 rounded-full px-3 py-1 text-xs text-white hover:bg-white/10 transition-all whitespace-nowrap"
            >
              Max
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/15" />

        {/* Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-white text-sm font-medium shrink-0">
              Deposit {currency}
            </span>
            <span className="text-white/70 text-sm text-right">
              {usdcAmount || "0.00"} <span className="mx-1">→</span> 99.99k
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">APY</span>
            <div className="flex items-center gap-1 text-white/70 text-sm">
              <Zap size={13} className="text-yellow-300 fill-yellow-300" />
              <span>{apy}%</span>
            </div>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-white text-sm font-medium shrink-0">
              Projected Earnings
            </span>
            <span className="text-white/70 text-sm text-right">
              {parsedAmount > 0
                ? `+${projectedEarnings} ${currency}`
                : `0.00 → 99.99k`}
            </span>
          </div>
        </div>
      </div>

      {/* Connect button — shows only when NOT connected */}
      {!isConnected && (
        <div className="flex justify-center">
          <Button
            variant="solid"
            color="default"
            onClick={() => void connect()}
            disabled={isConnecting}
            className="px-8 py-2.5 text-sm rounded-2xl"
          >
            {isConnecting ? "Connecting…" : "Connect Lace"}
          </Button>
        </div>
      )}

      {/* Submit Button */}
      <Button
        variant="gradient"
        color="primary"
        onClick={handleSubmit}
        disabled={!parsedAmount || parsedAmount <= 0 || submitting}
        className="w-full py-3.5 rounded-2xl text-base font-semibold shadow-[0_4px_24px_rgba(107,92,231,0.4)] bg-accent-alt! disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting
          ? "Register → deposit → sweep…"
          : isConnected
            ? "Deposit confidentially"
            : "Connect wallet first"}
      </Button>
    </div>
  );
};

export default DepositForm;
