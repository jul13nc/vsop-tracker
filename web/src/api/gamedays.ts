import { supabase } from "../lib/supabaseClient";
import type { GameEvent, Gameday, GamedayPlayer, GamedayStatus, Player, Season } from "../types/domain";
import type { SeatingEntry } from "../domain/seating";
import { gamedayId } from "../lib/ids";

export interface GamedayBundle {
  gameday: Gameday;
  season: Season;
  players: Player[];
  gamedayPlayers: GamedayPlayer[];
  events: GameEvent[];
}

/** Fetch one consistent snapshot, including only this gameday's participants. */
export async function getGamedayBundle(id: string): Promise<GamedayBundle> {
  const { data, error } = await supabase
    .from("gamedays")
    .select("*, season:seasons(*), gameday_players(*, player:players(*)), game_events(*)")
    .eq("id", id)
    .order("seq", { referencedTable: "game_events" })
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Journée introuvable");
  const { season, gameday_players, game_events, ...gameday } = data;
  if (!season) throw new Error("Saison introuvable");
  const players = gameday_players.flatMap(({ player }) => player ? [player] : [])
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  return {
    gameday,
    season,
    players,
    gamedayPlayers: gameday_players.map((entry) => {
      const { player, ...row } = entry;
      void player;
      return row;
    }),
    events: game_events,
  };
}

export async function listGamedays(seasonId: string): Promise<Gameday[]> {
  const { data, error } = await supabase
    .from("gamedays")
    .select("*")
    .eq("season_id", seasonId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Most recent gameday the public page should show (setup, live or finished). */
export async function getActiveGameday(
  seasonId?: string,
): Promise<Gameday | null> {
  // `reopened` is a client-side status but isn't present in the deployed
  // gameday_status enum yet; querying it makes Postgres reject the whole query.
  const find = async (statuses: GamedayStatus[]): Promise<Gameday | null> => {
    let query = supabase
      .from("gamedays")
      .select("*")
      .in("status", statuses)
      .order("date", { ascending: false })
      .limit(1);
    if (seasonId) query = query.eq("season_id", seasonId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  };

  // In-progress gamedays (live or setup) win over finished ones; among them
  // the most recent date wins, so a freshly created "setup" gameday is never
  // shadowed by an old "live" one that was never finished.
  return (await find(["live", "setup"])) ?? (await find(["finished"]));
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

export async function deleteGameday(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("gamedays")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Journée introuvable ou suppression non autorisée.");
}

export async function createGameday(
  seasonId: string,
  date: string,
  countsDouble: boolean,
  playerIds: string[],
  seating: SeatingEntry[] = [],
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
    const byPlayer = new Map(seating.map((s) => [s.playerId, s]));
    const rows = playerIds.map((player_id) => {
      const seat = byPlayer.get(player_id);
      return {
        gameday_id: id,
        player_id,
        table_number: seat?.table ?? null,
        seat_number: seat?.seat ?? null,
      };
    });
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

export async function reopenGameday(id: string): Promise<void> {
  const { error: playersError } = await supabase
    .from("gameday_players")
    .update({ final_rank: null, points: null })
    .eq("gameday_id", id);
  if (playersError) throw playersError;

  await setGamedayStatus(id, "reopened");
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
