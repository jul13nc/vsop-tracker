import { supabase } from "../lib/supabaseClient";
import { getGamedayBundle } from "./gamedays";
import { computeGamedayRanking } from "../domain/ranking";

export interface StandingRow {
  season_id: string;
  player_id: string;
  display_name: string;
  total_points: number;
  gamedays_played: number;
  seven_two_count: number;
}

export async function getStandings(seasonId: string): Promise<StandingRow[]> {
  const { data, error } = await supabase
    .from("season_standings")
    .select("*")
    .eq("season_id", seasonId);
  if (error) throw error;
  const rows = (data ?? []) as StandingRow[];
  return rows.sort((a, b) => b.total_points - a.total_points);
}

export async function getSevenTwoStandings(
  seasonId: string,
): Promise<StandingRow[]> {
  const rows = await getStandings(seasonId);
  return rows
    .filter((r) => r.seven_two_count > 0)
    .sort((a, b) => b.seven_two_count - a.seven_two_count);
}

/**
 * Validate a gameday: compute final ranks + points from its events, persist
 * them on gameday_players, and mark the gameday validated. The season_standings
 * view aggregates automatically from the persisted points.
 */
export async function validateGameday(
  gamedayId: string,
): Promise<void> {
  // Refresh participants and journal together. The RPC rejects results if an
  // event arrives meanwhile, and commits every rank + status atomically.
  const { players, events } = await getGamedayBundle(gamedayId);
  const ranking = computeGamedayRanking(players.map((row) => row.id), events);
  const { error } = await supabase.rpc("save_gameday_results", {
    p_gameday_id: gamedayId,
    p_expected_seq: events.reduce((seq, event) => Math.max(seq, event.seq), 0),
    p_results: ranking.map((row) => ({ player_id: row.playerId, final_rank: row.rank })),
  });
  if (error) throw error;
}
