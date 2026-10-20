import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import type { ReactNode } from "react";

// Admin
import LoginPage from "./features/admin/LoginPage";
import ForgotPasswordPage from "./features/admin/ForgotPasswordPage";
import ResetPasswordPage from "./features/admin/ResetPasswordPage";
import AdminLayout from "./features/admin/AdminLayout";
import SeasonsPage from "./features/admin/seasons/SeasonsPage";
import SeasonEditorPage from "./features/admin/seasons/SeasonEditorPage";
import PlayersPage from "./features/admin/PlayersPage";
import GamedaySetupPage from "./features/admin/gameday/GamedaySetupPage";
import GamedayPlacementPage from "./features/admin/gameday/GamedayPlacementPage";
import LivePage from "./features/admin/live/LivePage";
import ClockControlPage from "./features/admin/clock/ClockControlPage";
import ValidatePage from "./features/admin/validate/ValidatePage";

// Public
import PublicLayout from "./features/public/PublicLayout";
import StandingsPage from "./features/public/StandingsPage";
import SevenTwoPage from "./features/public/SevenTwoPage";
import ResultsPage from "./features/public/ResultsPage";
import PublicClockPage, { ActivePublicClockPage } from "./features/public/PublicClockPage";
import PublicPayoutPage from "./features/public/PublicPayoutPage";
import PublicHome from "./features/public/PublicHome";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="app">Chargement…</div>;
  if (!session) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pub" replace />} />

      {/* Public (no login) */}
      <Route path="/pub" element={<PublicHome />} />
      <Route path="/pub/:seasonId" element={<PublicLayout />}>
        <Route index element={<StandingsPage />} />
        <Route path="seven-two" element={<SevenTwoPage />} />
        <Route path="results" element={<ResultsPage />} />
      </Route>
      <Route path="/pub/:seasonId/clock/:gamedayId" element={<PublicClockPage />} />
      <Route path="/pub/clock" element={<ActivePublicClockPage />} />
      <Route path="/pub/:seasonId/payout/:gamedayId" element={<PublicPayoutPage />} />

      {/* Admin */}
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="seasons" replace />} />
        <Route path="seasons" element={<SeasonsPage />} />
        <Route path="seasons/:seasonId" element={<SeasonEditorPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="seasons/:seasonId/gameday/new" element={<GamedaySetupPage />} />
        <Route
          path="seasons/:seasonId/gameday/new/placement"
          element={<GamedayPlacementPage />}
        />
        <Route path="gameday/:gamedayId/live" element={<LivePage />} />
        <Route path="gameday/:gamedayId/clock" element={<ClockControlPage />} />
        <Route path="gameday/:gamedayId/validate" element={<ValidatePage />} />
      </Route>

      <Route path="*" element={<div className="app">Page introuvable.</div>} />
    </Routes>
  );
}
