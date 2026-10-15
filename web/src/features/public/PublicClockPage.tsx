import { Link, Navigate, useParams } from "react-router-dom";
import { useGameday } from "../../hooks/useGameday";
import { useClock } from "../../hooks/useClock";
import ClockView from "../../components/ClockView";
import { averageStack } from "../../domain/chips";
import { playersRemaining, totalRebuys } from "../../domain/ranking";
import {
  paidPlacesForTotal,
  resolvePayout,
  totalBetEuros,
} from "../../domain/payout";
import { rebuySecondsRemaining } from "../../domain/clock";

export default function PublicClockPage() {
  const { gamedayId } = useParams();
  const { data } = useGameday(gamedayId!);
  const { clock, state } = useClock(
    gamedayId!,
    data?.season.blind_structure ?? [],
    data?.season.blind_level_minutes ?? 20,
  );

  if (!data || !state || !clock)
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
