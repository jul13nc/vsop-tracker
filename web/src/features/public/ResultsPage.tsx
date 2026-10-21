import { useParams } from "react-router-dom";
import { getSeasonResults } from "../../api/results";
import { useAsync } from "../../hooks/useAsync";

export default function ResultsPage() {
  const { seasonId } = useParams();
  const { data, loading, error } = useAsync(() => getSeasonResults(seasonId!), [seasonId]);

  return (
    <div>
      <h2>Journées</h2>
      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      {(data ?? []).map((g) => (
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
                  <th>#</th>
                  <th>Joueur</th>
                  <th>Rang champ.</th>
                  <th>7/2</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.player_id}>
                    <td>{g.dayRankByPlayer[r.player_id]}</td>
                    <td>
                      {r.player?.display_name ?? r.player_id}
                      {(g.rebuyCountByPlayer[r.player_id] ?? 0) > 0
                        ? ` (R${g.rebuyOrderByPlayer[r.player_id]})`
                        : ""}
                      </td>
                    <td>{r.final_rank}</td>
                    <td>{g.sevenTwoByPlayer[r.player_id] ?? '-'}</td>
                    <td>{r.points}</td>
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
