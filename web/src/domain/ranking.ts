import type { GameEvent } from "../types/domain";

export interface PlayerLiveState {
  playerId: string;
  rebuys: number;
  /** seq of the player's FIRST rebuy, used to sort rebuyers in reverse order. */
  firstRebuyOrder: number | null;
  /** 1 = first eliminated. null = still alive. */
  eliminatedOrder: number | null;
}

/**
 * Replay the append-only event journal to derive each player's live state.
 *
 * Events of type "undo" reference a prior event id in payload.undoEventId and
 * cancel it (the referenced event is skipped during replay). An "undo" event
 * itself cannot be undone by another undo here; the live screen only emits undo
 * for the last cancellable event.
 */
export function replayEvents(
  playerIds: string[],
  events: GameEvent[],
): Map<string, PlayerLiveState> {
  const state = new Map<string, PlayerLiveState>();
  for (const id of playerIds) {
    state.set(id, {
      playerId: id,
      rebuys: 0,
      firstRebuyOrder: null,
      eliminatedOrder: null,
    });
  }

  const undone = new Set<number>();
  for (const e of events) {
    if (e.type === "undo") {
      const target = Number(e.payload?.undoEventId);
      if (!Number.isNaN(target)) undone.add(target);
    }
  }

  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  let eliminationCounter = 0;

  for (const e of ordered) {
    if (e.type === "undo" || undone.has(e.id)) continue;
    const ps = state.get(e.player_id);
    if (!ps) continue;

    switch (e.type) {
      case "rebuy":
        ps.rebuys += 1;
        if (ps.firstRebuyOrder === null) ps.firstRebuyOrder = e.seq;
        break;
      case "elimination":
        eliminationCounter += 1;
        ps.eliminatedOrder = eliminationCounter;
        break;
      case "seven_two":
        // tracked separately; no live-state impact
        break;
    }
  }

  return state;
}

export interface GamedayRankRow {
  playerId: string;
  rank: number;
  rebuys: number;
}

/**
 * Compute the CHAMPIONSHIP ranking (used for points).
 *
 * Ordering rules (from spec):
 *  - Non-rebuyers rank first, ordered by game performance: the winner (last
 *    player standing, never eliminated) is rank 1, then players in REVERSE
 *    order of elimination (last eliminated = better).
 *  - Rebuyers rank AFTER all non-rebuyers, sorted in REVERSE order of their
 *    first rebuy: the first player to rebuy ends up last overall.
 */
export function computeGamedayRanking(
  playerIds: string[],
  events: GameEvent[],
): GamedayRankRow[] {
  const state = replayEvents(playerIds, events);
  const all = [...state.values()];

  const nonRebuyers = all.filter((p) => p.rebuys === 0);
  const rebuyers = all.filter((p) => p.rebuys > 0);

  // Non-rebuyers: alive (eliminatedOrder null) first, then by descending
  // elimination order (last eliminated before first eliminated).
  nonRebuyers.sort((a, b) => {
    const ea = a.eliminatedOrder ?? Infinity;
    const eb = b.eliminatedOrder ?? Infinity;
    return eb - ea; // higher elimination order (later) ranks better
  });

  // Rebuyers: by ascending firstRebuyOrder => first rebuyer ranks worst, so we
  // place them in ascending order but AFTER non-rebuyers, meaning first rebuyer
  // gets the last overall rank. Sort ascending then reverse for placement.
  rebuyers.sort((a, b) => {
    const ra = a.firstRebuyOrder ?? Infinity;
    const rb = b.firstRebuyOrder ?? Infinity;
    return rb - ra; // later rebuyer ranks better among rebuyers
  });

  const orderedBest = [...nonRebuyers, ...rebuyers];

  return orderedBest.map((p, i) => ({
    playerId: p.playerId,
    rank: i + 1,
    rebuys: p.rebuys,
  }));
}

/**
 * Compute the PAYOUT ranking (used to distribute the prize pool).
 *
 * This is the PURE order of elimination, ignoring rebuys entirely:
 *  - The winner (never eliminated) is rank 1.
 *  - Then players in REVERSE order of elimination (last eliminated = rank 2,
 *    first eliminated = last rank).
 *
 * A player who rebuys and then goes deep still ranks by when they were finally
 * eliminated, exactly like everyone else.
 */
export function computePayoutRanking(
  playerIds: string[],
  events: GameEvent[],
): GamedayRankRow[] {
  const state = replayEvents(playerIds, events);
  const all = [...state.values()];

  all.sort((a, b) => {
    const ea = a.eliminatedOrder ?? Infinity; // alive => best
    const eb = b.eliminatedOrder ?? Infinity;
    return eb - ea; // later elimination ranks better
  });

  return all.map((p, i) => ({
    playerId: p.playerId,
    rank: i + 1,
    rebuys: p.rebuys,
  }));
}

/**
 * Assign R1, R2, ... by each player's first active rebuy event.
 * A player's later rebuys do not change their label; undone rebuys are ignored.
 */
export function rebuyOrderByPlayer(
  playerIds: string[],
  events: GameEvent[],
): Map<string, number> {
  const firstRebuys = [...replayEvents(playerIds, events).values()]
    .filter((player) => player.firstRebuyOrder !== null)
    .sort((a, b) => (a.firstRebuyOrder ?? 0) - (b.firstRebuyOrder ?? 0));

  return new Map(
    firstRebuys.map((player, index) => [player.playerId, index + 1]),
  );
}

/** Number of players still alive (not eliminated). */
export function playersRemaining(
  playerIds: string[],
  events: GameEvent[],
): number {
  const state = replayEvents(playerIds, events);
  return [...state.values()].filter((p) => p.eliminatedOrder === null).length;
}

/** Total number of rebuys across all players. */
export function totalRebuys(playerIds: string[], events: GameEvent[]): number {
  const state = replayEvents(playerIds, events);
  return [...state.values()].reduce((sum, p) => sum + p.rebuys, 0);
}
