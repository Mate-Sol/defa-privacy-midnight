import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getDeals } from "@/libs/midnightPools";
import Button from "../components/ui/Button";
import Typography from "../components/ui/Typography";

/**
 * Wellcome / hero landing after connecting. The legacy version rendered three
 * decorative SVGs with hard-coded numbers (16 / 25 / 85%) baked into the
 * artwork — they looked like real stats but were static images. The counters
 * now come off the local pool set so the numbers on the page match what the
 * pool list actually shows.
 */
const WellcomePage = () => {
  const navigate = useNavigate();
  const stats = useMemo(() => {
    const list = getDeals();
    const active = list.filter((d) => d.lifecycleState !== "Closed").length;
    const apys = list.map((d) => Number(d.apy || 0)).filter((n) => n > 0);
    const apyAvg = apys.length
      ? Math.round(apys.reduce((s, n) => s + n, 0) / apys.length)
      : 0;
    return { active, total: list.length, apyAvg };
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-120px)] w-full overflow-hidden flex items-center">
      <div className="relative z-10 flex flex-col gap-8 px-6 sm:px-16 max-w-xl w-full sm:w-auto text-center sm:text-left items-center sm:items-start">
        <Typography variant="h1" className="leading-tight">
          Start earning yields backed by real economic activities
        </Typography>

        <div className="flex flex-wrap gap-6 sm:gap-10 justify-center sm:justify-start">
          <Stat value={stats.active}                label="Active facilities" />
          <Stat value={stats.total}                 label="Total facilities" />
          <Stat value={`${stats.apyAvg || 0}%`}     label="Avg APR" />
        </div>

        <div>
          <Button
            variant="gradient"
            color="primary"
            onClick={() => navigate("/pools")}
            className="px-8 py-3 rounded-full text-white border border-white/30 bg-blue-500/40! backdrop-blur-sm hover:bg-white/20 transition-all"
          >
            Browse pools
          </Button>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ value, label }) => (
  <div className="flex flex-col items-center sm:items-start">
    <span className="text-4xl sm:text-5xl font-bold text-white tabular-nums">{value}</span>
    <span className="text-white/70 text-sm mt-1">{label}</span>
  </div>
);

export default WellcomePage;
