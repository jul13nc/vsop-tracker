import { useEffect, useRef, useState } from "react";
import { getClock } from "../api/clock";
import { supabase } from "../lib/supabaseClient";
import { clockState, type ClockState } from "../domain/clock";
import type { BlindLevel, TournamentClock } from "../types/domain";
import { useAsync } from "./useAsync";
import { usePolling } from "./usePolling";

interface Result {
  clock: TournamentClock | null;
  state: ClockState | null;
  /** True on the tick when the level just completed (for sound/flash). */
  justCompleted: boolean;
  reload: () => void;
}

/** Ticking clock driven by the server anchor + realtime updates. */
export function useClock(
  gamedayId: string,
  structure: BlindLevel[],
  levelDurationMinutes: number,
): Result {
  const { data: clock, reload, update } = useAsync(() => getClock(gamedayId), [gamedayId]);
  const [now, setNow] = useState(Date.now());
  const [justCompleted, setJustCompleted] = useState(false);
  const wasZero = useRef(false);

  usePolling(reload, 2000);

  useEffect(() => {
    const channel = supabase
      .channel(`clock:${gamedayId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_clock",
          filter: `gameday_id=eq.${gamedayId}`,
        },
        (payload) => update(payload.eventType === "DELETE" ? null : payload.new as TournamentClock),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gamedayId, update]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = clock
    ? clockState(structure, clock, now, levelDurationMinutes)
    : null;

  useEffect(() => {
    const atZero =
      state?.secondsRemaining === 0 && state.levelDurationMinutes > 0;
    if (atZero && !wasZero.current && clock?.is_running) {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 2000);
      wasZero.current = true;
      return () => clearTimeout(t);
    }
    if (!atZero) wasZero.current = false;
  }, [state?.secondsRemaining, state?.levelDurationMinutes, clock?.is_running]);

  return { clock, state, justCompleted, reload };
}
