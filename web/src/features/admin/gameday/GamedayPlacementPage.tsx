import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { listPlayers } from "../../../api/players";
import { getSeason } from "../../../api/seasons";
import { createGameday } from "../../../api/gamedays";
import { useAsync } from "../../../hooks/useAsync";
import ChipStack from "../../../components/ChipStack";
import { startingStackValue } from "../../../domain/chips";
import {
  groupByTable,
  MAX_PLAYERS_PER_TABLE,
  randomSeating,
  type SeatingEntry,
} from "../../../domain/seating";
import type { GamedaySetupState } from "./GamedaySetupPage";

/**
 * Step 2 of gameday creation: shows the starting stack configuration, draws a
 * random seating (tables + seats) for the participants, then creates the
 * gameday with that placement. The setup state is passed by GamedaySetupPage
 * through the router location state.
 */
export default function GamedayPlacementPage() {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as GamedaySetupState | null;

  const playerIds = state?.playerIds ?? [];
  const { data: players } = useAsync(listPlayers, []);
  const { data: season } = useAsync(() => getSeason(seasonId!), [seasonId]);

  const [playersPerTable, setPlayersPerTable] = useState(
    MAX_PLAYERS_PER_TABLE,
  );
  const [seating, setSeating] = useState<SeatingEntry[]>(() =>
    randomSeating(playerIds, MAX_PLAYERS_PER_TABLE),
  );
  const [busy, setBusy] = useState(false);

  const tables = useMemo(() => groupByTable(seating), [seating]);
  const nameById = useMemo(
    () => new Map((players ?? []).map((p) => [p.id, p.display_name])),
    [players],
  );

  if (!state || state.playerIds.length < 2) {
    // Deep link or refreshed without the setup state: back to step 1.
    return <Navigate to={`/admin/seasons/${seasonId}/gameday/new`} replace />;
  }
  // Captured non-null so closures below don't need to re-narrow.
  const setup: GamedaySetupState = state;

  const dateLabel = new Date(`${setup.date}T00:00:00`).toLocaleDateString(
    "fr-FR",
    { day: "numeric", month: "long", year: "numeric" },
  );

  function redraw(nextPerTable = playersPerTable) {
    setSeating(randomSeating(playerIds, nextPerTable));
  }

  function changePerTable(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 20) return;
    setPlayersPerTable(parsed);
    redraw(parsed);
  }

  async function start() {
    setBusy(true);
    try {
      const gd = await createGameday(
        seasonId!,
        setup.date,
        setup.countsDouble,
        setup.playerIds,
        seating,
      );
      navigate(`/admin/gameday/${gd.id}/live`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Placement des joueurs</h2>
      <p className="muted">
        Journée du {dateLabel}
        {setup.countsDouble ? " · compte double" : ""}
      </p>

      {season && (
        <div className="card">
          <h3>Stack de départ</h3>
          <ChipStack chips={season.chip_config} />
          <p className="muted">
            Chaque joueur reçoit {startingStackValue(season.chip_config)}{" "}
            jetons ({setup.playerIds.length} participants).
          </p>
        </div>
      )}

      <div className="card">
        <div className="row spread">
          <h3 style={{ margin: 0 }}>Placement aléatoire</h3>
          <button
            className="btn btn--ghost"
            onClick={() => redraw()}
            disabled={busy}
          >
            ⟳ Refaire le tirage
          </button>
        </div>

        <label style={{ display: "block", marginTop: 14 }}>
          Joueurs par table
        </label>
        <input
          type="number"
          min={1}
          max={20}
          style={{ maxWidth: 140 }}
          value={playersPerTable}
          onChange={(e) => changePerTable(e.target.value)}
        />

        <div className="tables-grid">
          {[...tables.entries()].map(([table, seats]) => (
            <div key={table} className="poker-table">
              <h4>Table {table}</h4>
              <ol>
                {seats.map((s) => (
                  <li key={s.playerId}>
                    <span className="seat-num">{s.seat}</span>
                    <span>{nameById.get(s.playerId) ?? s.playerId}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="row spread" style={{ marginTop: 4 }}>
        <button
          className="btn btn--ghost"
          onClick={() =>
            navigate(`/admin/seasons/${seasonId}/gameday/new`, {
              state: setup,
            })
          }
          disabled={busy}
        >
          Retour
        </button>
        <button className="btn" onClick={start} disabled={busy}>
          {busy ? "Création…" : "Démarrer la journée"}
        </button>
      </div>
    </div>
  );
}
