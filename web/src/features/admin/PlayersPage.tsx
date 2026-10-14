import { useState } from "react";
import { createPlayer, deletePlayer, listPlayers } from "../../api/players";
import { useAsync } from "../../hooks/useAsync";

export default function PlayersPage() {
  const { data, loading, error, reload } = useAsync(listPlayers, []);
  const [name, setName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createPlayer(name.trim());
    setName("");
    reload();
  }

  async function remove(id: string) {
    if (!confirm(`Supprimer ${id} ?`)) return;
    try {
      await deletePlayer(id);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <h2>Membres</h2>
      <form className="card row" onSubmit={add}>
        <input
          placeholder="Prénom du membre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn">Ajouter</button>
      </form>

      {loading && <p>Chargement…</p>}
      {error && <p style={{ color: "#ffbfb5" }}>{error.message}</p>}
      <div className="card">
        <table>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.display_name}</td>
                <td className="muted">{p.id}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn--danger" onClick={() => remove(p.id)}>
                    Suppr.
                  </button>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td className="muted">Aucun membre.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
