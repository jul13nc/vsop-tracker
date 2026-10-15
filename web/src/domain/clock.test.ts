import { describe, expect, it } from "vitest";
import {
  clockState,
  formatBlinds,
  formatClock,
  rebuySecondsRemaining,
} from "./clock";
import type { BlindLevel, TournamentClock } from "../types/domain";

const structure: BlindLevel[] = [
  { level: 1, small: 25, big: 50 },
  { level: 2, small: 50, big: 100 },
];

function clock(partial: Partial<TournamentClock>): TournamentClock {
  return {
    gameday_id: "g",
    current_level: 1,
    is_running: false,
    level_started_at: null,
    paused_elapsed_seconds: 0,
    ...partial,
  };
}

describe("clockState", () => {
  it("paused: remaining = level - paused elapsed", () => {
    const s = clockState(structure, clock({ paused_elapsed_seconds: 300 }), 0, 20);
    expect(s.secondsRemaining).toBe(20 * 60 - 300);
    expect(s.isRunning).toBe(false);
    expect(s.nextLevel?.level).toBe(2);
  });

  it("running: adds wall-clock since anchor", () => {
    const start = new Date("2026-01-01T20:00:00Z");
    const now = new Date("2026-01-01T20:05:00Z").getTime();
    const s = clockState(
      structure,
      clock({ is_running: true, level_started_at: start.toISOString() }),
      now,
      20,
    );
    expect(s.secondsRemaining).toBe(20 * 60 - 300);
  });

  it("flags levelComplete at zero", () => {
    const s = clockState(
      structure,
      clock({ paused_elapsed_seconds: 20 * 60 }),
      0,
      20,
    );
    expect(s.secondsRemaining).toBe(0);
    expect(s.levelComplete).toBe(true);
  });

  it("counts rebuy time across completed levels and current level", () => {
    const tournamentClock = clock({
      current_level: 2,
      paused_elapsed_seconds: 10 * 60,
    });
    const state = clockState(structure, tournamentClock, 0, 20);

    expect(rebuySecondsRemaining(tournamentClock, state, 90)).toBe(60 * 60);
    expect(rebuySecondsRemaining(tournamentClock, state, 30)).toBe(0);
  });

  it("uses the 90-minute default when season config is missing", () => {
    const tournamentClock = clock({ is_running: true });
    const state = clockState(structure, tournamentClock, 0, 20);

    expect(rebuySecondsRemaining(tournamentClock, state, undefined)).toBe(90 * 60);
  });
});

describe("formatters", () => {
  it("formatClock", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(1200)).toBe("20:00");
  });

  it("formatBlinds", () => {
    expect(formatBlinds(structure[0])).toBe("25 / 50");
    expect(formatBlinds(structure[1])).toBe("50 / 100");
    expect(formatBlinds(null)).toBe("—");
  });
});
