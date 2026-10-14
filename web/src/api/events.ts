import { supabase } from "../lib/supabaseClient";
import type { GameEvent, GameEventType } from "../types/domain";

export async function listEvents(gamedayId: string): Promise<GameEvent[]> {
  const { data, error } = await supabase
    .from("game_events")
    .select("*")
    .eq("gameday_id", gamedayId)
    .order("seq");
  if (error) throw error;
  return (data ?? []) as GameEvent[];
}

/** Append an event with the next sequence number for this gameday. */
export async function addEvent(
  gamedayId: string,
  type: GameEventType,
  playerId: string,
  payload: Record<string, unknown> | null = null,
): Promise<GameEvent> {
  const { data: last, error: e0 } = await supabase
    .from("game_events")
    .select("seq")
    .eq("gameday_id", gamedayId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e0) throw e0;

  const seq = (last?.seq ?? 0) + 1;
  const { data, error } = await supabase
    .from("game_events")
    .insert({ gameday_id: gamedayId, seq, type, player_id: playerId, payload })
    .select()
    .single();
  if (error) throw error;
  return data as GameEvent;
}

/**
 * Undo the last cancellable event (rebuy/elimination/seven_two that is not
 * already undone). Inserts an "undo" event referencing it.
 */
export async function undoLast(gamedayId: string): Promise<void> {
  const events = await listEvents(gamedayId);
  const undone = new Set<number>();
  for (const e of events) {
    if (e.type === "undo") {
      const t = Number(e.payload?.undoEventId);
      if (!Number.isNaN(t)) undone.add(t);
    }
  }
  const target = [...events]
    .reverse()
    .find((e) => e.type !== "undo" && !undone.has(e.id));
  if (!target) return;

  await addEvent(gamedayId, "undo", target.player_id, {
    undoEventId: target.id,
    undoneType: target.type,
  });
}
