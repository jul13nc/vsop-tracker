import { supabase } from "../lib/supabaseClient";
import type { Season } from "../types/domain";
import {
  DEFAULT_BLIND_STRUCTURE,
  DEFAULT_BLIND_LEVEL_MINUTES,
  DEFAULT_BUYIN_CENTS,
  DEFAULT_CHIP_CONFIG,
  DEFAULT_PAYOUT_TABLE,
  DEFAULT_POINTS_SCHEME,
  DEFAULT_REBUY_TIMEOUT_MINUTES,
} from "../types/defaults";

export async function listSeasons(): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("id", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSeason(id: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Create a season from a label like "2026/2027". Id = "2026-2027". */
export async function createSeason(label: string): Promise<Season> {
  const id = label.trim().replace(/\//g, "-");
  const { data, error } = await supabase
    .from("seasons")
    .insert({
      id,
      label: label.trim(),
      buyin_cents: DEFAULT_BUYIN_CENTS,
      payout_table: DEFAULT_PAYOUT_TABLE,
      chip_config: DEFAULT_CHIP_CONFIG,
      points_scheme: DEFAULT_POINTS_SCHEME,
      blind_level_minutes: DEFAULT_BLIND_LEVEL_MINUTES,
      rebuy_timeout_minutes: DEFAULT_REBUY_TIMEOUT_MINUTES,
      blind_structure: DEFAULT_BLIND_STRUCTURE,
      is_closed: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSeason(
  id: string,
  patch: Partial<Season>,
): Promise<void> {
  const { error } = await supabase.from("seasons").update(patch).eq("id", id);
  if (error) throw error;
}

export async function closeSeason(id: string): Promise<void> {
  await updateSeason(id, { is_closed: true });
}

export async function reopenSeason(id: string): Promise<void> {
  await updateSeason(id, { is_closed: false });
}
