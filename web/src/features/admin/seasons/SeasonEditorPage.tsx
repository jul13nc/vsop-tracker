import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { closeSeason, getSeason, updateSeason } from "../../../api/seasons";
import { listGamedays } from "../../../api/gamedays";
import { useAsync } from "../../../hooks/useAsync";
import type { BlindLevel, Season } from "../../../types/domain";

/** Controlled JSON textarea with validation. */
function JsonField({
  label,
  value,
  onValid,
}: {
  label: string;
  value: unknown;
  onValid: (parsed: unknown) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  function onChange(t: string) {
    setText(t);
    try {
      const parsed = JSON.parse(t);
      setErr(null);
      onValid(parsed);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div>
      <label>{label}</label>
      <textarea value={text} onChange={(e) => onChange(e.target.value)} />
      {err && <p style={{ color: "#ffbfb5", fontSize: "0.85rem" }}>{err}</p>}
    </div>
  );
}

function BlindStructureEditor({
  levels,
  duration,
  disabled,
  onDurationChange,
  onLevelsChange,
}: {
  levels: BlindLevel[];
  duration: number;
  disabled: boolean;
  onDurationChange: (minutes: number) => void;
  onLevelsChange: (levels: BlindLevel[]) => void;
}) {
  function updateLevel(index: number, field: "small" | "big", value: number) {
    onLevelsChange(
      levels.map((level, i) =>
        i === index ? { ...level, [field]: value } : level,
      ),
    );
  }

  function addLevel() {
    const previous = levels.at(-1);
    const next: BlindLevel = {
      level: levels.length + 1,
      small: previous ? previous.small * 2 : 25,
      big: previous ? previous.big * 2 : 50,
    };
    onLevelsChange([...levels, next]);
  }

  function removeLevel(index: number) {
    onLevelsChange(
      levels
        .filter((_, i) => i !== index)
        .map((level, i) => ({ ...level, level: i + 1 })),
    );
  }

  return (
    <section>
      <h3>Structure des blindes</h3>
      <label>Durée de chaque niveau (minutes)</label>
      <input
        type="number"
        min="1"
        step="1"
        disabled={disabled}
        value={duration}
        onChange={(e) => onDurationChange(Math.max(1, Number(e.target.value)))}
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Niveau</th>
              <th>SB</th>
              <th>BB</th>
              {!disabled && <th />}
            </tr>
          </thead>
          <tbody>
            {levels.map((level, index) => (
              <tr key={level.level}>
                <td>{level.level}</td>
                <td>
                  <input
                    aria-label={`SB niveau ${level.level}`}
                    type="number"
                    min="0"
                    step="1"
                    disabled={disabled}
                    value={level.small}
                    onChange={(e) =>
                      updateLevel(index, "small", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`BB niveau ${level.level}`}
                    type="number"
                    min="0"
                    step="1"
                    disabled={disabled}
                    value={level.big}
                    onChange={(e) =>
                      updateLevel(index, "big", Number(e.target.value))
                    }
                  />
                </td>
                {!disabled && (
                  <td>
                    <button
                      className="btn btn--danger"
                      type="button"
                      onClick={() => removeLevel(index)}
                      aria-label={`Supprimer niveau ${level.level}`}
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!disabled && (
          <button
            className="btn btn--ghost"
            type="button"
            onClick={addLevel}
            style={{ marginTop: 12 }}
          >
            + Ajouter niveau
          </button>
        )}
      </div>
    </section>
  );
}

export default function SeasonEditorPage() {
  const { seasonId } = useParams();
  const { data: season, reload } = useAsync(
    () => getSeason(seasonId!),
    [seasonId],
  );
  const { data: gamedays, reload: reloadGd } = useAsync(
    () => listGamedays(seasonId!),
    [seasonId],
  );

  const [draft, setDraft] = useState<Season | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (season) setDraft(season);
  }, [season]);

  if (!draft) return <p>Chargement…</p>;
  const readOnly = draft.is_closed;

  async function save() {
    setSaving(true);
    try {
      await updateSeason(draft!.id, {
        buyin_cents: draft!.buyin_cents,
        payout_table: draft!.payout_table,
        chip_config: draft!.chip_config,
        points_scheme: draft!.points_scheme,
        blind_level_minutes: draft!.blind_level_minutes,
        blind_structure: draft!.blind_structure,
      });
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function close() {
    if (!confirm("Clôturer la saison ? Plus aucune modification possible.")) return;
    await closeSeason(draft!.id);
    reload();
  }

  return (
    <div>
      <div className="row spread">
        <h2>{draft.label}</h2>
        {readOnly && <span className="badge">clôturée (lecture seule)</span>}
      </div>

      <div className="card">
        <label>Cave (€)</label>
        <input
          type="number"
          step="1"
          disabled={readOnly}
          value={draft.buyin_cents / 100}
          onChange={(e) =>
            setDraft({ ...draft, buyin_cents: Math.round(+e.target.value * 100) })
          }
        />

        <JsonField
          label="Répartition payouts (par total misé)"
          value={draft.payout_table}
          onValid={(v) => setDraft({ ...draft, payout_table: v as never })}
        />
        <JsonField
          label="Répartition des jetons"
          value={draft.chip_config}
          onValid={(v) => setDraft({ ...draft, chip_config: v as never })}
        />
        <JsonField
          label="Barème points (rang 1 → N)"
          value={draft.points_scheme}
          onValid={(v) => setDraft({ ...draft, points_scheme: v as never })}
        />
        <BlindStructureEditor
          levels={draft.blind_structure}
          duration={draft.blind_level_minutes}
          disabled={readOnly}
          onDurationChange={(minutes) =>
            setDraft({ ...draft, blind_level_minutes: minutes })
          }
          onLevelsChange={(blind_structure) =>
            setDraft({ ...draft, blind_structure })
          }
        />

        {!readOnly && (
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button className="btn btn--danger" onClick={close}>
              Clôturer la saison
            </button>
          </div>
        )}
      </div>

      <div className="row spread">
        <h3>Journées</h3>
        {!readOnly && (
          <Link
            className="btn"
            to={`/admin/seasons/${draft.id}/gameday/new`}
          >
            + Nouvelle journée
          </Link>
        )}
      </div>
      <div className="card">
        <table>
          <tbody>
            {(gamedays ?? []).map((g) => (
              <tr key={g.id}>
                <td>{g.date}</td>
                <td>
                  {g.counts_double && <span className="badge">x2</span>}{" "}
                  <span className="badge">{g.status}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link className="btn btn--ghost" to={`/admin/gameday/${g.id}/live`}>
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {gamedays && gamedays.length === 0 && (
              <tr>
                <td className="muted">Aucune journée.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button className="btn btn--ghost" onClick={() => reloadGd()}>
        Rafraîchir
      </button>
    </div>
  );
}
