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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 100);
    };
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
        { event: "*", schema: "public", table: "gamedays", filter: `id=eq.${gamedayId}` },
        fire,
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [gamedayId]);
}
