import { Link, Navigate, useParams } from "react-router-dom";
import { getActiveGameday } from "../../api/gamedays";
import { useGameday } from "../../hooks/useGameday";
import { useAsync } from "../../hooks/useAsync";
import { useClock } from "../../hooks/useClock";
import { usePolling } from "../../hooks/usePolling";
import ClockView from "../../components/ClockView";
import PublicPreGameView from "./PublicPreGameView";
import { averageStack } from "../../domain/chips";
import { playersRemaining, totalRebuys } from "../../domain/ranking";
import {
  paidPlacesForTotal,
  resolvePayout,
  totalBetEuros,
} from "../../domain/payout";
import { rebuySecondsRemaining } from "../../domain/clock";

export function ActivePublicClockPage() {
  const { data: active, loading, error, reload } = useAsync(getActiveGameday, []);

  usePolling(reload, 5000);

  if (loading && !active) return <div className="app">Chargement de la journée…</div>;
  if (error) return <div className="app">Erreur : {error.message}</div>;
  if (!active) return <div className="app">Aucune journée en cours.</div>;

  return <PublicClockDisplay gamedayId={active.id} />;
}

export default function PublicClockPage() {
  const { gamedayId: routeGamedayId } = useParams();
  if (!routeGamedayId) return <div className="app">Aucune journée en cours.</div>;
  return <PublicClockDisplay gamedayId={routeGamedayId} />;
}

function PublicClockDisplay({ gamedayId }: { gamedayId: string }) {
  const { data } = useGameday(gamedayId!);
  const { clock, state } = useClock(
    gamedayId!,
    data?.season.blind_structure ?? [],
    data?.season.blind_level_minutes ?? 20,
  );

  if (!data) return <div className="app">Chargement de la journée…</div>;

  // Created but not started yet: show the stacks and the table placement.
  // Switches to the clock once the admin starts the gameday (status "live").
  if (data.gameday.status === "setup") {
    return (
      <PublicPreGameView
        gameday={data.gameday}
        season={data.season}
        players={data.players}
        gamedayPlayers={data.gamedayPlayers}
      />
    );
  }

  if (!state || !clock)
    return <div className="app">Chargement de l'horloge…</div>;

  // Once the gameday is validated, switch to the standings.
  if (data.gameday.status === "validated") {
    return <Navigate to={`/pub/${data.season.id}`} replace />;
  }

  const ids = data.players.map((p) => p.id);
  const remaining = playersRemaining(ids, data.events);
  if (remaining === 1) {
    return (
      <Navigate
        to={`/pub/${data.season.id}/payout/${data.gameday.id}`}
        replace
      />
    );
  }

  const entries = data.players.length + totalRebuys(ids, data.events);
  const avg = averageStack(data.season.chip_config, entries, remaining);
  const rebuyCount = totalRebuys(ids, data.events);
  const totalBet = totalBetEuros(
    data.players.length,
    rebuyCount,
    data.season.buyin_cents,
  );
  const paidPlaces = paidPlacesForTotal(totalBet, data.season.payout_table);
  let payout: { rank: number; amount: number }[] = [];
  try {
    payout = resolvePayout(totalBet, data.season.payout_table);
  } catch {
    // Payout may not be configured for this total yet.
  }
  const upcomingLevels = data.season.blind_structure.filter(
    (level) => level.level > (state.level?.level ?? 0),
  );

  return (
    <ClockView
      state={state}
      playersRemaining={remaining}
      startingPlayers={data.players.length}
      averageStack={avg}
      rebuySecondsRemaining={rebuySecondsRemaining(
        clock,
        state,
        data.season.rebuy_timeout_minutes,
      )}
      isBubble={
        paidPlaces > 0 &&
        remaining === paidPlaces + 1
      }
      isInTheMoney={paidPlaces > 0 && remaining <= paidPlaces}
      payout={payout}
      upcomingLevels={upcomingLevels}
      flash={state.levelComplete}
      playBeep
    >
      <div className="clock__controls">
        <Link className="btn btn--ghost" to={`/pub/${data.season.id}`}>
          ← Classement
        </Link>
      </div>
    </ClockView>
  );
}
