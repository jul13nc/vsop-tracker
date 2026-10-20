import { describe, expect, it } from "vitest";
import {
  groupByTable,
  MAX_PLAYERS_PER_TABLE,
  randomSeating,
  shuffle,
  type SeatingEntry,
} from "./seating";

/** Deterministic LCG so shuffles are reproducible in tests. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p${i + 1}`);
}

describe("shuffle", () => {
  it("keeps the same elements", () => {
    const input = ids(10);
    const out = shuffle(input, seeded(42));
    expect([...out].sort()).toEqual([...input].sort());
    expect(input).toEqual(ids(10)); // input untouched
  });
});

describe("randomSeating", () => {
  it("places every player exactly once", () => {
    const players = ids(11);
    const seating = randomSeating(players, 4, seeded(1));
    expect(seating).toHaveLength(players.length);
    expect(new Set(seating.map((s) => s.playerId))).toEqual(
      new Set(players),
    );
  });

  it("keeps tables within the maximum size", () => {
    const seating = randomSeating(ids(11), 4, seeded(2));
    const tables = groupByTable(seating);
    for (const list of tables.values()) {
      expect(list.length).toBeLessThanOrEqual(4);
      expect(new Set(list.map((s) => s.seat)).size).toBe(list.length);
    }
    // 11 players / 4 per table => tables 1..3, sizes 4/4/3
    expect(tables.size).toBe(3);
    expect([...tables.values()].map((l) => l.length)).toEqual([4, 4, 3]);
  });

  it("uses a single table when everyone fits", () => {
    const seating = randomSeating(ids(5), 9, seeded(3));
    expect(groupByTable(seating).size).toBe(1);
    expect(seating.every((s) => s.table === 1)).toBe(true);
    expect(seating.map((s) => s.seat).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("fills seats sequentially with the default size", () => {
    const seating = randomSeating(ids(20), MAX_PLAYERS_PER_TABLE, seeded(4));
    const tables = groupByTable(seating);
    expect(tables.size).toBe(3);
    expect([...tables.values()].map((l) => l.length)).toEqual([9, 9, 2]);
  });

  it("is deterministic with the same seed", () => {
    const players = ids(8);
    const a = randomSeating(players, 4, seeded(7));
    const b = randomSeating(players, 4, seeded(7));
    expect(a).toEqual(b);
  });

  it("produces a different order across seeds", () => {
    const players = ids(8);
    const a = randomSeating(players, 4, seeded(1));
    const b = randomSeating(players, 4, seeded(2));
    expect(a.map((s) => s.playerId)).not.toEqual(b.map((s) => s.playerId));
  });

  it("rejects an invalid players-per-table value", () => {
    expect(() => randomSeating(ids(3), 0)).toThrow();
    expect(() => randomSeating(ids(3), 2.5)).toThrow();
  });

  it("returns an empty seating for no players", () => {
    expect(randomSeating([], 9, seeded(5))).toEqual([]);
  });
});

describe("groupByTable", () => {
  it("orders tables and seats ascending", () => {
    const seating: SeatingEntry[] = [
      { playerId: "b", table: 1, seat: 2 },
      { playerId: "c", table: 2, seat: 1 },
      { playerId: "a", table: 1, seat: 1 },
    ];
    const tables = groupByTable(seating);
    expect([...tables.keys()]).toEqual([1, 2]);
    expect(tables.get(1)!.map((s) => s.playerId)).toEqual(["a", "b"]);
    expect(tables.get(2)!.map((s) => s.playerId)).toEqual(["c"]);
  });
});
