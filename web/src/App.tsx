import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { lazy, Suspense, type ReactNode } from "react";

// Admin
const LoginPage = lazy(() => import("./features/admin/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./features/admin/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./features/admin/ResetPasswordPage"));
const AdminLayout = lazy(() => import("./features/admin/AdminLayout"));
const SeasonsPage = lazy(() => import("./features/admin/seasons/SeasonsPage"));
const SeasonEditorPage = lazy(() => import("./features/admin/seasons/SeasonEditorPage"));
const PlayersPage = lazy(() => import("./features/admin/PlayersPage"));
const GamedaySetupPage = lazy(() => import("./features/admin/gameday/GamedaySetupPage"));
const GamedayPlacementPage = lazy(() => import("./features/admin/gameday/GamedayPlacementPage"));
const LivePage = lazy(() => import("./features/admin/live/LivePage"));
const ClockControlPage = lazy(() => import("./features/admin/clock/ClockControlPage"));
const ValidatePage = lazy(() => import("./features/admin/validate/ValidatePage"));

// Public
const PublicLayout = lazy(() => import("./features/public/PublicLayout"));
const StandingsPage = lazy(() => import("./features/public/StandingsPage"));
const SevenTwoPage = lazy(() => import("./features/public/SevenTwoPage"));
const ResultsPage = lazy(() => import("./features/public/ResultsPage"));
const PublicClockPage = lazy(() => import("./features/public/PublicClockPage"));
const ActivePublicClockPage = lazy(() => import("./features/public/PublicClockPage")
  .then((module) => ({ default: module.ActivePublicClockPage })));
const PublicPayoutPage = lazy(() => import("./features/public/PublicPayoutPage"));
import PublicHome from "./features/public/PublicHome";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="app">Chargement…</div>;
  if (!session) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div className="app">Chargement…</div>}>
    <Routes>
      <Route path="/" element={<Navigate to="/pub" replace />} />

      {/* Public (no login) */}
      <Route path="/pub" element={<PublicHome />} />
      <Route path="/pub/:seasonId" element={<PublicLayout />}>
        <Route index element={<StandingsPage />} />
        <Route path="seven-two" element={<SevenTwoPage />} />
        <Route path="results" element={<ResultsPage />} />
      </Route>
      <Route path="/pub/:seasonId/gameday/:gamedayId" element={<PublicClockPage />} />
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
    </Suspense>
  );
}
