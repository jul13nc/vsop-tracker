import { Link } from "react-router-dom";
import { listSeasons } from "../../api/seasons";
import { useAsync } from "../../hooks/useAsync";

export default function PublicHome() {
  const { data, loading, error } = useAsync(listSeasons, []);
  return (
    <div className="app">
      <header className="public-hero">
        <div className="brand-mark brand-mark--hero" aria-hidden="true">♠</div>
        <p className="eyebrow">SAISON APRÈS SAISON</p>
        <h1>VSOP Poker</h1>
        <p className="muted">Le championnat. Chaque main compte.</p>
      </header>
      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      {(data ?? []).map((s) => (
        <Link
          key={s.id}
          to={`/pub/${s.id}`}
          className="season-card row spread"
          style={{ textDecoration: "none" }}
        >
          <span>
            <small className="eyebrow">SAISON</small>
            <strong>{s.label}</strong>
          </span>
          <span className="season-card__action">
            {s.is_closed && <span className="badge">clôturée</span>}
            <span aria-hidden="true">↗</span>
          </span>
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
