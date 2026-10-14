import { useParams } from "react-router-dom";
import { getStandings } from "../../api/standings";
import { useAsync } from "../../hooks/useAsync";

export default function StandingsPage() {
  const { seasonId } = useParams();
  const { data, loading, error } = useAsync(
    () => getStandings(seasonId!),
    [seasonId],
  );

  return (
    <div>
      <h2>Classement général</h2>
      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th>Pts</th>
              <th>Journées</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r, i) => (
              <tr key={r.player_id}>
                <td>{i + 1}</td>
                <td>{r.display_name}</td>
                <td>
                  <b style={{ color: "var(--gold)" }}>{r.total_points}</b>
                </td>
                <td>{r.gamedays_played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
