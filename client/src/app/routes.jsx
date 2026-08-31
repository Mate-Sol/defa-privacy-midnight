import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { HomePage } from "../pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import WellcomePage from "@/pages/WellcomePage";
import DashboardPage from "@/pages/DashboardPage";
import PoolList from "@/pages/PoolList";
import PoolDetails from "@/pages/PoolDetails";

/**
 * Wave-1 scope: the confidential LENDER side only.
 *
 * The borrower / PayMate / PayFi surfaces this app shipped with — loans,
 * drawdown, repay-for-psp, send-to-psp, fund-withdraw, PSP payouts,
 * create-pool, lender-list, finance-details, tokenization, reports, admin —
 * are Wave-2/3. Their source files are left in place untouched; they are
 * simply not routed and not in the nav. Same for the backend-account pages
 * (register / access-code / support / refer), which have no backend here.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Connect screen — Lace wallet is the session */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/sample" element={<HomePage />} />
      {/* ======================================================= */}
      {/* dashboard */}
      <Route element={<AppLayout />}>
        <Route path="/wellcome" element={<WellcomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pools" element={<PoolList />} />
        {/* Pool detail carries the My Position / disclose tab + DepositForm */}
        <Route path="/pool/:dealId" element={<PoolDetails />} />
      </Route>
      {/* ======================================================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
