import { Link, useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameday } from "../../../hooks/useGameday";
import { addEvent, undoLast } from "../../../api/events";
import { setGamedayStatus } from "../../../api/gamedays";
import { ensureClock, pauseClock } from "../../../api/clock";
import SeatingTables from "../../../components/SeatingTables";
import { seatingFromRows } from "../../../domain/seating";
import {
  playersRemaining,
  replayEvents,
  totalRebuys,
} from "../../../domain/ranking";
import { totalBetEuros } from "../../../domain/payout";
import { sevenTwoCounts } from "../../../domain/sevenTwo";
import { clockState } from "../../../domain/clock";

export default function LivePage() {
  const { gamedayId } = useParams();
  const navigate = useNavigate();
  const finishHandled = useRef(false);
  const { data, loading, error, reload } = useGameday(gamedayId!, 0);

  useEffect(() => {
    // The gameday stays "setup" (public page shows stacks + placement) until
    // it is actually launched: clock start or first recorded event.
    if (
      !data ||
      (data.gameday.status !== "live" && data.gameday.status !== "setup") ||
      finishHandled.current
    ) {
      return;
    }
    const playerIds = data.players.map((player) => player.id);
    if (playersRemaining(playerIds, data.events) !== 1) return;

    finishHandled.current = true;
    const finish = async () => {
      try {
        const clock = await ensureClock(gamedayId!);
        if (clock.is_running) {
          const current = clockState(
            data.season.blind_structure,
            clock,
            Date.now(),
            data.season.blind_level_minutes,
          );
          const elapsed =
            data.season.blind_level_minutes * 60 - current.secondsRemaining;
          await pauseClock(clock, elapsed);
        }
        if (data.gameday.status === "live" || data.gameday.status === "setup") {
          await setGamedayStatus(gamedayId!, "finished");
        }
        navigate(`/admin/gameday/${gamedayId}/validate`, { replace: true });
      } catch (caught) {
        finishHandled.current = false;
        console.error("Impossible de terminer automatiquement la partie", caught);
      }
    };

    void finish();
  }, [data, gamedayId, navigate]);

  if (loading) return <div className="app">Chargement…</div>;
  if (error) return <div className="app">Erreur : {error.message}</div>;
  if (!data) return null;

  const { gameday, season, players, events, gamedayPlayers } = data;
  const ids = players.map((p) => p.id);
  const state = replayEvents(ids, events);
  const remaining = playersRemaining(ids, events);
  const rebuys = totalRebuys(ids, events);
  const bet = totalBetEuros(players.length, rebuys, season.buyin_cents);
  const sevenTwo = sevenTwoCounts(events);
  const finished = remaining <= 1;
  const nameById = new Map(players.map((p) => [p.id, p.display_name]));
  const { seating, unplaced } = seatingFromRows(gamedayPlayers);

  async function act(
    type: "rebuy" | "elimination" | "seven_two",
    playerId: string,
  ) {
    await addEvent(gamedayId!, type, playerId);
    // The first recorded action launches the gameday: the public page then
    // switches from the stacks/placement screen to the clock.
    if (gameday.status === "setup") {
      await setGamedayStatus(gamedayId!, "live");
    }
    reload();
  }

  async function undo() {
    await undoLast(gamedayId!);
    reload();
  }

  async function markFinished() {
    await setGamedayStatus(gamedayId!, "finished");
    reload();
  }

  return (
    <div>
      <div className="row spread">
        <h2 style={{ margin: 0 }}>{gameday.date}</h2>
        <div className="row">
          <Link className="btn btn--ghost" to={`/admin/gameday/${gameday.id}/clock`}>
            Horloge
          </Link>
          <button className="btn btn--ghost" onClick={undo}>
            Annuler
          </button>
        </div>
      </div>

      <div className="card row spread">
        <div>
          <b style={{ color: "var(--gold)" }}>{remaining}</b> restants
        </div>
        <div>
          Recaves : <b>{rebuys}</b>
        </div>
        <div>
          Total : <b>{bet}€</b>
        </div>
      </div>

      {seating.length > 0 && (
        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            Placement des tables
          </summary>
          <SeatingTables seating={seating} nameById={nameById} />
          {unplaced.length > 0 && (
            <p className="muted">Non placés : {unplaced.join(", ")}</p>
          )}
        </details>
      )}

      <div className="grid-players">
        {players.map((p) => {
          const ps = state.get(p.id)!;
          const out = ps.eliminatedOrder !== null;
          const s72 = sevenTwo.get(p.id) ?? 0;
          return (
            <div
              key={p.id}
              className={`player-live${out ? " eliminated" : ""}`}
            >
              <div className="row spread">
                <span className="player-live__name">{p.display_name}</span>
                <span>
                  {ps.rebuys > 0 && (
                    <span className="badge badge--rebuy">R×{ps.rebuys}</span>
                  )}{" "}
                  {s72 > 0 && <span className="badge">7/2 ×{s72}</span>}{" "}
                  {out && <span className="badge">#{ps.eliminatedOrder} out</span>}
                </span>
              </div>
              <div className="player-live__actions">
                <button
                  className="btn"
                  onClick={() => act("rebuy", p.id)}
                  disabled={out}
                >
                  +Recave
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => act("seven_two", p.id)}
                >
                  7/2
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => act("elimination", p.id)}
                  disabled={out}
                >
                  Éliminé
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        {finished ? (
          <>
            <p>Il ne reste qu'un joueur — la partie est terminée.</p>
            <Link
              className="btn btn--block"
              to={`/admin/gameday/${gameday.id}/validate`}
              onClick={markFinished}
            >
              Voir payout & valider
            </Link>
          </>
        ) : (
          <Link
            className="btn btn--ghost btn--block"
            to={`/admin/gameday/${gameday.id}/validate`}
          >
            Aperçu payout
          </Link>
        )}
      </div>
    </div>
  );
}
