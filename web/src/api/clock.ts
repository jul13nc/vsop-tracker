import { supabase } from "../lib/supabaseClient";
import type { TournamentClock } from "../types/domain";

export async function getClock(
  gamedayId: string,
): Promise<TournamentClock | null> {
  const { data, error } = await supabase
    .from("tournament_clock")
    .select("*")
    .eq("gameday_id", gamedayId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsert(row: TournamentClock): Promise<void> {
  const { error } = await supabase
    .from("tournament_clock")
    .upsert({ ...row, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function ensureClock(gamedayId: string): Promise<TournamentClock> {
  const existing = await getClock(gamedayId);
  if (existing) return existing;
  const row: TournamentClock = {
    gameday_id: gamedayId,
    current_level: 1,
    is_running: false,
    level_started_at: null,
    paused_elapsed_seconds: 0,
  };
  await upsert(row);
  return row;
}

export async function startClock(c: TournamentClock): Promise<void> {
  await upsert({
    ...c,
    is_running: true,
    level_started_at: new Date().toISOString(),
  });
}

export async function pauseClock(
  c: TournamentClock,
  elapsedSeconds: number,
): Promise<void> {
  await upsert({
    ...c,
    is_running: false,
    level_started_at: null,
    paused_elapsed_seconds: elapsedSeconds,
  });
}

export async function gotoLevel(
  c: TournamentClock,
  level: number,
): Promise<void> {
  await upsert({
    ...c,
    current_level: Math.max(1, level),
    paused_elapsed_seconds: 0,
    level_started_at: c.is_running ? new Date().toISOString() : null,
  });
}
