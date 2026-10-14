import { useParams } from "react-router-dom";
import { getSevenTwoStandings } from "../../api/standings";
import { useAsync } from "../../hooks/useAsync";

export default function SevenTwoPage() {
  const { seasonId } = useParams();
  const { data, loading, error } = useAsync(
    () => getSevenTwoStandings(seasonId!),
    [seasonId],
  );

  return (
    <div>
      <h2>Classement 7/2</h2>
      <p className="muted">Mains gagnées avec 7/2</p>
      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th>7/2</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r, i) => (
              <tr key={r.player_id}>
                <td>{i + 1}</td>
                <td>{r.display_name}</td>
                <td>
                  <b style={{ color: "var(--gold)" }}>{r.seven_two_count}</b>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td className="muted" colSpan={3}>
                  Aucune main 7/2 enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
