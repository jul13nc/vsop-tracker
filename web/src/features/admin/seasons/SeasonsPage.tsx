import { useState } from "react";
import { Link } from "react-router-dom";
import { createSeason, deleteSeason, listSeasons } from "../../../api/seasons";
import { useAsync } from "../../../hooks/useAsync";

export default function SeasonsPage() {
  const { data, loading, error, reload } = useAsync(listSeasons, []);
  const [label, setLabel] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await createSeason(label.trim());
    setLabel("");
    reload();
  }

  async function remove(id: string, seasonLabel: string) {
    if (!confirm(`Supprimer la saison ${seasonLabel} et toutes ses journées ? Cette action est irréversible.`)) return;
    setDeleteError(null);
    try {
      await deleteSeason(id);
      reload();
    } catch (caught) {
      setDeleteError((caught as Error).message);
    }
  }

  return (
    <div>
      <h2>Saisons</h2>
      <form className="card row" onSubmit={add}>
        <input
          placeholder="2026/2027"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="btn">Créer</button>
      </form>

      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      {deleteError && <p style={{ color: "#ffbfb5" }}>{deleteError}</p>}

      {(data ?? []).map((s) => (
        <div className="card row spread" key={s.id}>
          <div>
            <strong>{s.label}</strong>{" "}
            {s.is_closed && <span className="badge">clôturée</span>}
          </div>
          <div className="row">
            <Link className="btn btn--ghost" to={`/admin/seasons/${s.id}`}>
              Gérer
            </Link>
            <button
              className="btn btn--danger"
              onClick={() => remove(s.id, s.label)}
              aria-label={`Supprimer la saison ${s.label}`}
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
