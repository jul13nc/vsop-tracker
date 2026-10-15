import { supabase } from "../lib/supabaseClient";
import { listEvents } from "./events";
import { computeGamedayRanking } from "../domain/ranking";
import { pointsForRank } from "../domain/points";

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
  playerIds: string[],
  pointsScheme: number[],
  countsDouble: boolean,
): Promise<void> {
  // Reload the journal at validation time so undo events are always reflected,
  // even when the validation screen was opened before the last change.
  const events = await listEvents(gamedayId);
  const ranking = computeGamedayRanking(playerIds, events);

  for (const row of ranking) {
    const points = pointsForRank(row.rank, pointsScheme, countsDouble);
    const { error } = await supabase
      .from("gameday_players")
      .update({ final_rank: row.rank, points })
      .eq("gameday_id", gamedayId)
      .eq("player_id", row.playerId);
    if (error) throw error;
  }

  const { error: e2 } = await supabase
    .from("gamedays")
    .update({ status: "validated" })
    .eq("id", gamedayId);
  if (e2) throw e2;
}
