import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { listPlayers } from "../../../api/players";
import { useAsync } from "../../../hooks/useAsync";

/** State handed over to the placement step via the router location state. */
export interface GamedaySetupState {
  date: string;
  countsDouble: boolean;
  playerIds: string[];
}

export default function GamedaySetupPage() {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: players } = useAsync(listPlayers, []);

  // Restored when coming back from the placement step.
  const restore = location.state as Partial<GamedaySetupState> | null;

  const [date, setDate] = useState(
    restore?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [countsDouble, setCountsDouble] = useState(
    restore?.countsDouble ?? false,
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(restore?.playerIds ?? []),
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function goToPlacement() {
    if (selected.size < 2) {
      alert("Sélectionne au moins 2 joueurs.");
      return;
    }
    const state: GamedaySetupState = {
      date,
      countsDouble,
      playerIds: [...selected],
    };
    navigate(`/admin/seasons/${seasonId}/gameday/new/placement`, {
      state,
    });
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

      <button className="btn btn--block" onClick={goToPlacement}>
        Continuer · placement des joueurs
      </button>
    </div>
  );
}
