import { useEffect, useRef, useState } from "react";
import { getClock } from "../api/clock";
import { supabase } from "../lib/supabaseClient";
import { clockState, type ClockState } from "../domain/clock";
import type { BlindLevel, TournamentClock } from "../types/domain";

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
  const [clock, setClock] = useState<TournamentClock | null>(null);
  const [now, setNow] = useState(Date.now());
  const [justCompleted, setJustCompleted] = useState(false);
  const wasZero = useRef(false);

  function reload() {
    getClock(gamedayId).then(setClock);
  }

  useEffect(() => {
    reload();
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
        (payload) => setClock(payload.new as TournamentClock),
      )
      .subscribe();
    // Poll as a fallback: browser/device websocket proxies can silently fail
    // while REST remains reachable. Realtime stays the fast path; polling
    // guarantees every display eventually sees pause/start/level changes.
    const poll = window.setInterval(() => {
      getClock(gamedayId).then(setClock).catch(() => undefined);
    }, 2000);
    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamedayId]);

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
