import { supabase } from "../lib/supabaseClient";
import type { Player } from "../types/domain";
import { slugify } from "../lib/ids";

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("display_name");
  if (error) throw error;
  return data ?? [];
}

export async function createPlayer(displayName: string): Promise<Player> {
  const id = slugify(displayName);
  const { data, error } = await supabase
    .from("players")
    .insert({ id, display_name: displayName })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}
