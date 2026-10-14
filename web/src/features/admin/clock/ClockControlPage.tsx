import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGameday } from "../../../hooks/useGameday";
import { useClock } from "../../../hooks/useClock";
import ClockView from "../../../components/ClockView";
import {
  ensureClock,
  gotoLevel,
  pauseClock,
  startClock,
} from "../../../api/clock";
import { averageStack } from "../../../domain/chips";
import { playersRemaining, totalRebuys } from "../../../domain/ranking";
import { paidPlacesForTotal, totalBetEuros } from "../../../domain/payout";

export default function ClockControlPage() {
  const { gamedayId } = useParams();
  const navigate = useNavigate();
  const finishHandled = useRef(false);
  const { data } = useGameday(gamedayId!);
  const { clock, state } = useClock(
    gamedayId!,
    data?.season.blind_structure ?? [],
    data?.season.blind_level_minutes ?? 20,
  );

  useEffect(() => {
    ensureClock(gamedayId!);
  }, [gamedayId]);

  const ids = data?.players.map((p) => p.id) ?? [];
  const remaining = data ? playersRemaining(ids, data.events) : 0;

  useEffect(() => {
    if (!data || !clock || !state || remaining !== 1 || finishHandled.current) {
      return;
    }

    finishHandled.current = true;
    const openPayout = async () => {
      try {
        if (clock.is_running) {
          await pauseClock(clock, totalElapsed(state));
        }
        navigate(`/admin/gameday/${gamedayId}/validate`, { replace: true });
      } catch (error) {
        finishHandled.current = false;
        console.error("Impossible d'arrêter l'horloge automatiquement", error);
      }
    };

    void openPayout();
  }, [data, clock, state, remaining, navigate, gamedayId]);

  if (!data || !state || !clock)
    return <div className="app">Chargement de l'horloge…</div>;

  const entries = data.players.length + totalRebuys(ids, data.events);
  const avg = averageStack(data.season.chip_config, entries, remaining);
  const totalBet = totalBetEuros(
    data.players.length,
    totalRebuys(ids, data.events),
    data.season.buyin_cents,
  );
  const paidPlaces = paidPlacesForTotal(totalBet, data.season.payout_table);

  const pubLink = `/pub/${data.season.id}/clock/${gamedayId}`;

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
        {clock.is_running ? (
          <button
            className="btn"
            onClick={() => pauseClock(clock, totalElapsed(state))}
          >
            Pause
          </button>
        ) : (
          <button className="btn" onClick={() => startClock(clock)}>
            Démarrer
          </button>
        )}
        <button
          className="btn btn--ghost"
          onClick={() => gotoLevel(clock, clock.current_level - 1)}
        >
          ◀ Niveau
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => gotoLevel(clock, clock.current_level + 1)}
        >
          Niveau ▶
        </button>
      </div>
      <div className="clock__controls">
        <Link
          className="btn btn--ghost"
          to={`/admin/gameday/${gamedayId}/live`}
        >
          ← Joueurs
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Lien public :{" "}
        <a href={pubLink} target="_blank" rel="noreferrer">
          {pubLink}
        </a>
      </p>
    </ClockView>
  );
}

/** Elapsed seconds in the current level (to freeze on pause). */
function totalElapsed(state: {
  levelDurationMinutes: number;
  secondsRemaining: number;
}): number {
  const levelSeconds = state.levelDurationMinutes * 60;
  return levelSeconds - state.secondsRemaining;
}
