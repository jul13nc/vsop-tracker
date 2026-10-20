// Placement aléatoire des participants : tables et sièges.

export interface SeatingEntry {
  playerId: string;
  /** Table number, starting at 1. */
  table: number;
  /** Seat number within the table, starting at 1. */
  seat: number;
}

/** Default maximum number of players per table. */
export const MAX_PLAYERS_PER_TABLE = 9;

/**
 * Fisher–Yates shuffle returning a new array (input untouched).
 * `rng` is injectable so tests can use a deterministic generator.
 */
export function shuffle<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Random seating: shuffles the players, then fills tables of at most
 * `playersPerTable` seats (table 1 seats 1..n, then table 2, ...).
 *
 * Every player appears exactly once; tables are filled sequentially so table
 * sizes differ by at most one player.
 */
export function randomSeating(
  playerIds: readonly string[],
  playersPerTable: number = MAX_PLAYERS_PER_TABLE,
  rng: () => number = Math.random,
): SeatingEntry[] {
  if (!Number.isInteger(playersPerTable) || playersPerTable < 1) {
    throw new Error("playersPerTable doit être un entier ≥ 1");
  }
  return shuffle(playerIds, rng).map((playerId, index) => ({
    playerId,
    table: Math.floor(index / playersPerTable) + 1,
    seat: (index % playersPerTable) + 1,
  }));
}

/** Group seating entries by table (ascending), seats ordered ascending. */
export function groupByTable(
  seating: readonly SeatingEntry[],
): Map<number, SeatingEntry[]> {
  const tables = new Map<number, SeatingEntry[]>();
  for (const entry of seating) {
    const list = tables.get(entry.table) ?? [];
    list.push(entry);
    tables.set(entry.table, list);
  }
  for (const list of tables.values()) {
    list.sort((a, b) => a.seat - b.seat);
  }
  return new Map([...tables.entries()].sort((a, b) => a[0] - b[0]));
}

/** Minimal gameday_players shape needed to rebuild a seating. */
export interface SeatingRow {
  player_id: string;
  table_number: number | null;
  seat_number: number | null;
}

/**
 * Rebuild a seating from persisted gameday_players rows. Players without a
 * stored table/seat (gamedays predating the placement feature) are returned
 * separately as player ids.
 */
export function seatingFromRows(rows: readonly SeatingRow[]): {
  seating: SeatingEntry[];
  unplaced: string[];
} {
  const seating: SeatingEntry[] = [];
  const unplaced: string[] = [];
  for (const row of rows) {
    if (row.table_number != null && row.seat_number != null) {
      seating.push({
        playerId: row.player_id,
        table: row.table_number,
        seat: row.seat_number,
      });
    } else {
      unplaced.push(row.player_id);
    }
  }
  return { seating, unplaced };
}
