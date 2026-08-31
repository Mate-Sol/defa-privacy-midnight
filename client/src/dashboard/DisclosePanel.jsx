import React, { useState } from "react";
import { Eye, ShieldCheck, Lock } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Chip from "../components/ui/Chip";
import { toast } from "react-toastify";
import { useMidnight } from "@/midnight/context";

/**
 * Selective disclosure — the headline privacy move.
 *
 * Your position sits on-chain as an ElGamal ciphertext that nobody else can
 * read. "Disclose" decrypts it locally with your viewing key so you can show
 * an auditor exactly your own stake — and nothing about anyone else's. Claim
 * burns from the same position to pull liquidity back out.
 *
 * Net-new for the Midnight build; the Arc app had no equivalent.
 */
const UNIT = 1_000_000; // 6 decimals

const DisclosePanel = ({ deal }) => {
  const { actions, isConnected, connect, refresh } = useMidnight();
  const [busy, setBusy] = useState(null);
  const [disclosed, setDisclosed] = useState(null);
  const [claimAmount, setClaimAmount] = useState("");

  if (!deal?.isLive) {
    return (
      <Card variant="simple" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-white/60" />
          <span className="text-white font-semibold text-sm">
            Simulated pool · Wave-2
          </span>
        </div>
        <p className="text-white/60 text-sm leading-relaxed">
          This pool illustrates a lifecycle state ({deal?.lifecycleState}) in the
          DeFa portfolio. The live confidential deposit / claim / disclose flow
          runs on the Midnight-wired pool.
        </p>
        <p className="text-white/40 text-xs">{deal?.wave2Note}</p>
      </Card>
    );
  }

  const onDisclose = async () => {
    if (!actions) return;
    setBusy("disclose");
    try {
      const res = await actions.disclose();
      setDisclosed({
        amount: Number(res.amount) / UNIT,
        ciphertextHex: res.ciphertextHex,
      });
      toast.success("Position decrypted with your viewing key");
    } catch (e) {
      toast.error(e?.message || "Disclose failed");
    } finally {
      setBusy(null);
    }
  };

  const onClaim = async () => {
    if (!actions) return;
    const amt = Number(claimAmount);
    if (!amt || amt <= 0) {
      toast.warning("Enter a positive amount to claim");
      return;
    }
    setBusy("claim");
    try {
      await actions.claim(BigInt(Math.round(amt * UNIT)));
      toast.success(`Claimed ${amt} back from your confidential position`);
      setClaimAmount("");
      refresh();
    } catch (e) {
      toast.error(e?.message || "Claim failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card variant="simple" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-400" />
          <span className="text-white font-semibold text-sm">
            Confidential position
          </span>
        </div>
        <Chip
          variant="low"
          dot={false}
          className="px-3! py-1! text-[11px]! bg-emerald-400/20!"
        >
          ● Live on Midnight
        </Chip>
      </div>

      <p className="text-white/60 text-sm leading-relaxed">{deal?.privacyNote}</p>

      {!isConnected ? (
        <Button
          variant="gradient"
          color="primary"
          onClick={() => void connect()}
          className="w-full py-3 rounded-2xl text-sm"
        >
          Connect Lace to view your position
        </Button>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="gradient"
              color="primary"
              onClick={onDisclose}
              disabled={!!busy}
              className="flex-1 py-3 rounded-2xl text-sm px-6!"
            >
              <Eye size={15} className="mr-2" />
              {busy === "disclose" ? "Decrypting…" : "Disclose position"}
            </Button>

            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={claimAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d*\.?\d*$/.test(v)) setClaimAmount(v);
                }}
                placeholder="Amount"
                className="min-w-0 flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder-white/40 focus:border-white/40"
              />
              <Button
                variant="solid"
                color="default"
                onClick={onClaim}
                disabled={!!busy}
                className="py-3 px-6! rounded-2xl text-sm whitespace-nowrap"
              >
                {busy === "claim" ? "Claiming…" : "Claim"}
              </Button>
            </div>
          </div>

          {disclosed && (
            <div className="rounded-2xl bg-emerald-400/10 border border-emerald-400/30 p-4 flex flex-col gap-1">
              <span className="text-white/60 text-xs uppercase tracking-wide">
                Disclosed to auditor
              </span>
              <span className="text-white font-bold text-2xl">
                ${disclosed.amount.toLocaleString("en-US")}
              </span>
              <span className="text-white/50 text-[11px] break-all font-mono">
                ciphertext {disclosed.ciphertextHex}
              </span>
              <span className="text-white/40 text-[11px] mt-1 leading-relaxed">
                Decrypted client-side with your viewing key. The on-chain value
                stays encrypted to everyone else.
              </span>
            </div>
          )}
        </>
      )}

      <p className="text-white/40 text-xs leading-relaxed border-t border-white/10 pt-3">
        {deal?.wave2Note}
      </p>
    </Card>
  );
};

export default DisclosePanel;
