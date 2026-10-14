import type { BlindLevel, TournamentClock } from "../types/domain";

export interface ClockState {
  level: BlindLevel | null;
  nextLevel: BlindLevel | null;
  levelDurationMinutes: number;
  /** Seconds remaining in the current level. */
  secondsRemaining: number;
  isRunning: boolean;
  /** True when a level just elapsed (secondsRemaining hit 0). */
  levelComplete: boolean;
}

/**
 * Compute the live clock state from the persisted server anchor.
 *
 * - When running, elapsed = paused_elapsed_seconds + (now - level_started_at).
 * - When paused, elapsed = paused_elapsed_seconds.
 */
export function clockState(
  structure: BlindLevel[],
  clock: TournamentClock,
  nowMs: number,
  levelDurationMinutes: number,
): ClockState {
  const level =
    structure.find((l) => l.level === clock.current_level) ?? null;
  const nextLevel =
    structure.find((l) => l.level === clock.current_level + 1) ?? null;

  const levelSeconds = (level ? levelDurationMinutes : 0) * 60;

  let elapsed = clock.paused_elapsed_seconds;
  if (clock.is_running && clock.level_started_at) {
    const startMs = new Date(clock.level_started_at).getTime();
    elapsed += Math.max(0, Math.floor((nowMs - startMs) / 1000));
  }

  const secondsRemaining = Math.max(0, levelSeconds - elapsed);

  return {
    level,
    nextLevel,
    levelDurationMinutes,
    secondsRemaining,
    isRunning: clock.is_running,
    levelComplete: levelSeconds > 0 && secondsRemaining === 0,
  };
}

/** Format seconds as MM:SS. */
export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatBlinds(level: BlindLevel | null): string {
  if (!level) return "—";
  return `${level.small} / ${level.big}`;
}
