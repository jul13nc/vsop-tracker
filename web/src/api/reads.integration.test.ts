import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../types/db";

// Opt-in, read-only checks against the local Supabase API. No hosted endpoint.
vi.mock("../lib/supabaseClient", () => ({
  supabase: createClient<Database>(
    "http://127.0.0.1:54321",
    import.meta.env.VITE_SUPABASE_ANON_KEY || "local-test-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  ),
}));

import { supabase } from "../lib/supabaseClient";
import { getGameday, getGamedayBundle, listGamedayPlayers, listGamedays } from "./gamedays";
import { getSeasonResults } from "./results";
import { listEvents } from "./events";
import { getSeason } from "./seasons";
import { listPlayers } from "./players";

describe.skipIf(import.meta.env.VITE_LOCAL_API_TESTS !== "1")("local relational API", () => {
  it("loads a gameday snapshot equivalent to separate table reads", async () => {
    const { data: days, error } = await supabase.from("gamedays").select("id").limit(1);
    if (error) throw error;
    expect(days?.length, "Create at least one local gameday before running API integration tests").toBe(1);
    const id = days![0].id;
    const bundle = await getGamedayBundle(id);
    const [day, season, participants, events] = await Promise.all([
      supabase.from("gamedays").select("*").eq("id", id).single(),
      supabase.from("seasons").select("*").eq("id", bundle.gameday.season_id).single(),
      supabase.from("gameday_players").select("*").eq("gameday_id", id),
      supabase.from("game_events").select("*").eq("gameday_id", id).order("seq"),
    ]);
    for (const result of [day, season, participants, events]) {
      if (result.error) throw result.error;
    }
    expect(bundle.gameday).toEqual(day.data);
    expect(bundle.season).toEqual(season.data);
    expect(bundle.events).toEqual(events.data);
    expect(bundle.gamedayPlayers).toEqual(expect.arrayContaining(participants.data!));
    expect(bundle.gamedayPlayers.length).toBe(participants.data!.length);
    expect(bundle.players.map((p) => p.id).sort())
      .toEqual(participants.data!.map((p) => p.player_id).sort());
  });

  it("fetches nested season results through PostgREST", async () => {
    const { data: days, error } = await supabase.from("gamedays").select("season_id").limit(1);
    if (error) throw error;
    expect(days?.length).toBe(1);
    const results = await getSeasonResults(days![0].season_id);
    expect(results.length).toBeGreaterThan(0);
    for (const day of results) {
      for (const row of day.rows) {
        expect(row.player?.id).toBe(row.player_id);
        expect(row.final_rank).not.toBeNull();
      }
    }
  });

  it("reports local read latency before and after batching", async () => {
    const { data, error } = await supabase.from("gamedays").select("id, season_id").limit(1);
    if (error) throw error;
    expect(data?.length).toBe(1);
    const day = data![0];
    const oldBundle = async () => {
      const gameday = await getGameday(day.id);
      return Promise.all([
        getSeason(gameday!.season_id), listGamedayPlayers(day.id),
        listEvents(day.id), listPlayers(),
      ]);
    };
    const oldResults = async () => {
      const [days] = await Promise.all([listGamedays(day.season_id), listPlayers()]);
      return Promise.all(days.map((g) => Promise.all([listGamedayPlayers(g.id), listEvents(g.id)])));
    };
    for (const [name, before, after] of [
      ["gameday", oldBundle, () => getGamedayBundle(day.id)],
      ["season results", oldResults, () => getSeasonResults(day.season_id)],
    ] as const) {
      const samples = { before: [] as number[], after: [] as number[] };
      await before();
      await after();
      for (let i = 0; i < 10; i++) {
        const operations = i % 2 ? [["after", after], ["before", before]] as const
          : [["before", before], ["after", after]] as const;
        for (const [key, operation] of operations) {
          const start = performance.now();
          await operation();
          samples[key].push(performance.now() - start);
        }
      }
      const median = (values: number[]) => {
        values.sort((a, b) => a - b);
        return ((values[4] + values[5]) / 2).toFixed(1);
      };
      console.info(`${name}: local median, 10 warm runs: ${median(samples.before)} ms -> ${median(samples.after)} ms`);
    }
  });
});
