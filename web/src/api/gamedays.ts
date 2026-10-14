import { supabase } from "../lib/supabaseClient";
import type { Gameday, GamedayPlayer, GamedayStatus } from "../types/domain";
import { gamedayId } from "../lib/ids";

export async function listGamedays(seasonId: string): Promise<Gameday[]> {
  const { data, error } = await supabase
    .from("gamedays")
    .select("*")
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Most recent gameday that is live or finished (clock worth showing). */
export async function getActiveGameday(
  seasonId: string,
): Promise<Gameday | null> {
  const { data, error } = await supabase
    .from("gamedays")
    .select("*")
    .eq("season_id", seasonId)
    .in("status", ["live", "finished"])
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGameday(id: string): Promise<Gameday | null> {
  const { data, error } = await supabase
    .from("gamedays")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createGameday(
  seasonId: string,
  date: string,
  countsDouble: boolean,
  playerIds: string[],
): Promise<Gameday> {
  const id = gamedayId(seasonId, date);
  const { data, error } = await supabase
    .from("gamedays")
    .insert({
      id,
      season_id: seasonId,
      date,
      counts_double: countsDouble,
      status: "setup",
    })
    .select()
    .single();
  if (error) throw error;

  if (playerIds.length) {
    const rows = playerIds.map((player_id) => ({ gameday_id: id, player_id }));
    const { error: e2 } = await supabase.from("gameday_players").insert(rows);
    if (e2) throw e2;
  }
  return data;
}

export async function setGamedayStatus(
  id: string,
  status: GamedayStatus,
): Promise<void> {
  const { error } = await supabase
    .from("gamedays")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function listGamedayPlayers(
  gamedayId: string,
): Promise<GamedayPlayer[]> {
  const { data, error } = await supabase
    .from("gameday_players")
    .select("*")
    .eq("gameday_id", gamedayId);
  if (error) throw error;
  return data ?? [];
}
