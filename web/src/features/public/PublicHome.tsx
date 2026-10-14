import { Link } from "react-router-dom";
import { listSeasons } from "../../api/seasons";
import { useAsync } from "../../hooks/useAsync";

export default function PublicHome() {
  const { data, loading, error } = useAsync(listSeasons, []);
  return (
    <div className="app">
      <h1>VSOP Poker</h1>
      <p className="muted">Championnat — classements &amp; résultats</p>
      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      {(data ?? []).map((s) => (
        <Link
          key={s.id}
          to={`/c/${s.id}`}
          className="card row spread"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <strong>{s.label}</strong>
          {s.is_closed && <span className="badge">clôturée</span>}
        </Link>
      ))}
      {data && data.length === 0 && (
        <div className="card">
          <p className="muted">Aucune saison pour le moment.</p>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <Link className="btn btn--ghost" to="/admin">
          Espace admin →
        </Link>
      </div>
    </div>
  );
}
