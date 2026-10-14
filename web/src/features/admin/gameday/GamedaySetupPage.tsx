import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listPlayers } from "../../../api/players";
import { getSeason } from "../../../api/seasons";
import { createGameday } from "../../../api/gamedays";
import { useAsync } from "../../../hooks/useAsync";
import { startingStackValue } from "../../../domain/chips";

export default function GamedaySetupPage() {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const { data: players } = useAsync(listPlayers, []);
  const { data: season } = useAsync(() => getSeason(seasonId!), [seasonId]);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [countsDouble, setCountsDouble] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function create() {
    if (selected.size < 2) {
      alert("Sélectionne au moins 2 joueurs.");
      return;
    }
    setBusy(true);
    try {
      const gd = await createGameday(
        seasonId!,
        date,
        countsDouble,
        [...selected],
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
      <h2>Nouvelle journée</h2>
      <div className="card">
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="row" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            style={{ width: "auto", minHeight: 0 }}
            checked={countsDouble}
            onChange={(e) => setCountsDouble(e.target.checked)}
          />
          <span>Compte double pour le championnat</span>
        </label>
      </div>

      {season && (
        <div className="card">
          <h3>Répartition des jetons</h3>
          <table>
            <tbody>
              {season.chip_config.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>valeur {c.value}</td>
                  <td>×{c.count}</td>
                  <td>{c.value * c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            Stack de départ : {startingStackValue(season.chip_config)} jetons
          </p>
        </div>
      )}

      <div className="card">
        <h3>Participants ({selected.size})</h3>
        <div className="grid-players">
          {(players ?? []).map((p) => (
            <label key={p.id} className="row">
              <input
                type="checkbox"
                style={{ width: "auto", minHeight: 0 }}
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span>{p.display_name}</span>
            </label>
          ))}
        </div>
      </div>

      <button className="btn btn--block" onClick={create} disabled={busy}>
        {busy ? "Création…" : "Démarrer la journée"}
      </button>
    </div>
  );
}
