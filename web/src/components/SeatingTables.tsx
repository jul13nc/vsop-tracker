import { groupByTable, type SeatingEntry } from "../domain/seating";

interface Props {
  seating: SeatingEntry[];
  nameById: Map<string, string>;
}

/** Grid of poker tables with numbered seats and player names. */
export default function SeatingTables({ seating, nameById }: Props) {
  const tables = groupByTable(seating);
  return (
    <>
      <p className="muted" style={{ margin: "0 0 12px" }}>
        Numéro 1 au BTN, ensuite en sens horaire
      </p>
      <div className="tables-grid">
        {[...tables.entries()].map(([table, seats]) => (
          <div key={table} className="poker-table">
            <h4>Table {table}</h4>
            <ol>
              {seats.map((s) => (
                <li key={s.playerId}>
                  <span className="seat-num">{s.seat}</span>
                  <span>{nameById.get(s.playerId) ?? s.playerId}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
