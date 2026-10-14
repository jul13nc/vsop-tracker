import { useParams } from "react-router-dom";
import { listGamedays, listGamedayPlayers } from "../../api/gamedays";
import { listPlayers } from "../../api/players";
import { useAsync } from "../../hooks/useAsync";
import type { GamedayPlayer, Player } from "../../types/domain";

interface ResultsData {
  gamedays: {
    id: string;
    date: string;
    counts_double: boolean;
    status: string;
    rows: GamedayPlayer[];
  }[];
  players: Player[];
}

async function load(seasonId: string): Promise<ResultsData> {
  const gamedays = await listGamedays(seasonId);
  const players = await listPlayers();
  const withRows = await Promise.all(
    gamedays.map(async (g) => ({
      id: g.id,
      date: g.date,
      counts_double: g.counts_double,
      status: g.status,
      rows: (await listGamedayPlayers(g.id))
        .filter((r) => r.final_rank !== null)
        .sort((a, b) => (a.final_rank ?? 0) - (b.final_rank ?? 0)),
    })),
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
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.player_id}>
                    <td>{r.final_rank}</td>
                    <td>
                      {nameOf(r.player_id)}{" "}
                      {r.rebuys > 0 && (
                        <span className="badge badge--rebuy">R×{r.rebuys}</span>
                      )}
                    </td>
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
