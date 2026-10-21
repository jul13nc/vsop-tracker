import { supabase } from "../lib/supabaseClient";
import { sevenTwoCounts } from "../domain/sevenTwo";
import { computePayoutRanking, rebuyOrderByPlayer, replayEvents } from "../domain/ranking";

/** One relational query rather than two extra requests for every gameday. */
export async function getSeasonResults(seasonId: string) {
  const { data, error } = await supabase
    .from("gamedays")
    .select("id, date, counts_double, status, gameday_players(*, player:players(id, display_name)), game_events(*)")
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .order("seq", { referencedTable: "game_events" });
  if (error) throw error;
  return (data ?? []).map(({ gameday_players: participants, game_events: events, ...gameday }) => {
    const ids = participants.map((row) => row.player_id);
    const dayRankByPlayer = Object.fromEntries(
      computePayoutRanking(ids, events).map((row) => [row.playerId, row.rank]),
    );
    return {
      ...gameday,
      dayRankByPlayer,
      sevenTwoByPlayer: Object.fromEntries(sevenTwoCounts(events)),
      rebuyCountByPlayer: Object.fromEntries(
        [...replayEvents(ids, events)].map(([id, state]) => [id, state.rebuys]),
      ),
      rebuyOrderByPlayer: Object.fromEntries(rebuyOrderByPlayer(ids, events)),
      rows: participants.filter((row) => row.final_rank !== null).sort(
        (a, b) => (dayRankByPlayer[a.player_id] ?? Infinity) -
          (dayRankByPlayer[b.player_id] ?? Infinity),
      ),
    };
  });
}
