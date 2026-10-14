import { useParams } from "react-router-dom";
import { listGamedays, listGamedayPlayers } from "../../api/gamedays";
import { listEvents } from "../../api/events";
import { listPlayers } from "../../api/players";
import { useAsync } from "../../hooks/useAsync";
import { sevenTwoCounts } from "../../domain/sevenTwo";
import {
  computePayoutRanking,
  rebuyOrderByPlayer,
  replayEvents,
} from "../../domain/ranking";
import type { GamedayPlayer, Player } from "../../types/domain";

interface ResultsData {
  gamedays: {
    id: string;
    date: string;
    counts_double: boolean;
    status: string;
    rows: GamedayPlayer[];
    sevenTwoByPlayer: Record<string, number>;
    dayRankByPlayer: Record<string, number>;
    rebuyCountByPlayer: Record<string, number>;
    rebuyOrderByPlayer: Record<string, number>;
  }[];
  players: Player[];
}

async function load(seasonId: string): Promise<ResultsData> {
  const gamedays = await listGamedays(seasonId);
  const players = await listPlayers();
  const withRows = await Promise.all(
    gamedays.map(async (g) => {
      const [gamedayPlayers, events] = await Promise.all([
        listGamedayPlayers(g.id),
        listEvents(g.id),
      ]);
      return {
        id: g.id,
        date: g.date,
        counts_double: g.counts_double,
        status: g.status,
        rows: gamedayPlayers
          .filter((r) => r.final_rank !== null)
          .sort((a, b) => (a.final_rank ?? 0) - (b.final_rank ?? 0)),
        sevenTwoByPlayer: Object.fromEntries(sevenTwoCounts(events)),
        dayRankByPlayer: Object.fromEntries(
          computePayoutRanking(gamedayPlayers.map((row) => row.player_id), events)
            .map((row) => [row.playerId, row.rank]),
        ),
        rebuyCountByPlayer: Object.fromEntries(
          [...replayEvents(gamedayPlayers.map((row) => row.player_id), events)]
            .map(([playerId, state]) => [playerId, state.rebuys]),
        ),
        rebuyOrderByPlayer: Object.fromEntries(
          rebuyOrderByPlayer(
            gamedayPlayers.map((row) => row.player_id),
            events,
          ),
        ),
      };
    }),
  );
  return { gamedays: withRows, players };
}

export default function ResultsPage() {
  const { seasonId } = useParams();
  const { data, loading, error } = useAsync(() => load(seasonId!), [seasonId]);

  const nameOf = (id: string) =>
    data?.players.find((p) => p.id === id)?.display_name ?? id;

  return (
    <div>
      <h2>Journées</h2>
      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      {(data?.gamedays ?? []).map((g) => (
        <div className="card" key={g.id}>
          <div className="row spread">
            <strong>{g.date}</strong>
            <span>
              {g.counts_double && <span className="badge">x2</span>}{" "}
              {g.status !== "validated" && (
                <span className="badge">{g.status}</span>
              )}
            </span>
          </div>
          {g.rows.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Rang championnat</th>
                  <th>Joueur</th>
                  <th>7/2</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.player_id}>
                    <td>{r.final_rank}</td>
                    <td>
                      {nameOf(r.player_id)} - {g.dayRankByPlayer[r.player_id] ?? "—"}
                      {(g.rebuyCountByPlayer[r.player_id] ?? 0) > 0
                        ? ` (R${g.rebuyOrderByPlayer[r.player_id]})`
                        : ""}
                    </td>
                    <td>{g.sevenTwoByPlayer[r.player_id] ?? '-'}</td>
                    <td>{r.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Non validée.</p>
          )}
        </div>
      ))}
    </div>
  );
}
