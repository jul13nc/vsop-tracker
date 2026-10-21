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
  const { data, error } = await supabase.rpc("append_game_event", {
    p_gameday_id: gamedayId,
    p_type: type,
    p_player_id: playerId,
    p_payload: payload,
  });
  if (error) throw error;
  if (!data) throw new Error("Événement non enregistré");
  return data;
}

/**
 * Undo the last cancellable event (rebuy/elimination/seven_two that is not
 * already undone). Inserts an "undo" event referencing it.
 */
export async function undoLast(gamedayId: string): Promise<void> {
  const { error } = await supabase.rpc("undo_game_event", { p_gameday_id: gamedayId });
  if (error) throw error;
}
