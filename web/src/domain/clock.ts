import type { BlindLevel, TournamentClock } from "../types/domain";
import { DEFAULT_REBUY_TIMEOUT_MINUTES } from "../types/defaults";

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

/** Tournament time elapsed, excluding pauses, based on completed/current levels. */
export function tournamentElapsedSeconds(
  clock: TournamentClock,
  state: ClockState,
): number {
  const completedLevels = Math.max(0, clock.current_level - 1);
  const elapsedInLevel =
    state.levelDurationMinutes * 60 - state.secondsRemaining;
  return Math.max(
    0,
    completedLevels * state.levelDurationMinutes * 60 + elapsedInLevel,
  );
}

export function rebuySecondsRemaining(
  clock: TournamentClock,
  state: ClockState,
  timeoutMinutes: number | null | undefined,
): number {
  const durationMinutes =
    typeof timeoutMinutes === "number" && Number.isFinite(timeoutMinutes)
      ? timeoutMinutes
      : DEFAULT_REBUY_TIMEOUT_MINUTES;
  return Math.max(
    0,
    durationMinutes * 60 - tournamentElapsedSeconds(clock, state),
  );
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
