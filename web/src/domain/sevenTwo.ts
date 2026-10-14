import type { GameEvent } from "../types/domain";

/** Count 7/2 wins per player from the event journal (undo-aware). */
export function sevenTwoCounts(events: GameEvent[]): Map<string, number> {
  const undone = new Set<number>();
  for (const e of events) {
    if (e.type === "undo") {
      const target = Number(e.payload?.undoEventId);
      if (!Number.isNaN(target)) undone.add(target);
    }
  }

  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "seven_two" || undone.has(e.id)) continue;
    counts.set(e.player_id, (counts.get(e.player_id) ?? 0) + 1);
  }
  return counts;
}
