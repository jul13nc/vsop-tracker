import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

/** Subscribe to postgres changes for a gameday and invoke onChange. */
export function useRealtimeGameday(gamedayId: string | null, onChange: () => void) {
  // Keep the latest callback in a ref so the subscription is set up once per
  // gamedayId and never torn down just because onChange's identity changed.
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!gamedayId) return;
    const fire = () => cb.current();
    const channel = supabase
      .channel(`gameday:${gamedayId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_events", filter: `gameday_id=eq.${gamedayId}` },
        fire,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gameday_players", filter: `gameday_id=eq.${gamedayId}` },
        fire,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_clock", filter: `gameday_id=eq.${gamedayId}` },
        fire,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gamedays", filter: `id=eq.${gamedayId}` },
        fire,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gamedayId]);
}
