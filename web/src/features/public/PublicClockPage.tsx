import { Link, Navigate, useParams } from "react-router-dom";
import { useGameday } from "../../hooks/useGameday";
import { useClock } from "../../hooks/useClock";
import ClockView from "../../components/ClockView";
import { averageStack } from "../../domain/chips";
import { playersRemaining, totalRebuys } from "../../domain/ranking";
import { paidPlacesForTotal, totalBetEuros } from "../../domain/payout";

export default function PublicClockPage() {
  const { gamedayId } = useParams();
  const { data } = useGameday(gamedayId!);
  const { state } = useClock(
    gamedayId!,
    data?.season.blind_structure ?? [],
    data?.season.blind_level_minutes ?? 20,
  );

  if (!data || !state)
    return <div className="app">Chargement de l'horloge…</div>;

  // Once the gameday is validated, switch to the standings.
  if (data.gameday.status === "validated") {
    return <Navigate to={`/c/${data.season.id}`} replace />;
  }

  const ids = data.players.map((p) => p.id);
  const remaining = playersRemaining(ids, data.events);
  if (remaining === 1) {
    return (
      <Navigate
        to={`/c/${data.season.id}/payout/${data.gameday.id}`}
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

  return (
    <ClockView
      state={state}
      playersRemaining={remaining}
      averageStack={avg}
      isBubble={paidPlaces > 0 && remaining === paidPlaces + 1}
      flash={state.levelComplete}
      playBeep
    >
      <div className="clock__controls">
        <Link className="btn btn--ghost" to={`/c/${data.season.id}`}>
          ← Classement
        </Link>
      </div>
    </ClockView>
  );
}
