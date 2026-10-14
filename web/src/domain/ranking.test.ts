import { describe, expect, it } from "vitest";
import {
  computeGamedayRanking,
  computePayoutRanking,
  playersRemaining,
  rebuyOrderByPlayer,
  replayEvents,
  totalRebuys,
} from "./ranking";
import type { GameEvent } from "../types/domain";

let seq = 0;
let id = 0;
function ev(
  type: GameEvent["type"],
  player_id: string,
  payload: Record<string, unknown> | null = null,
): GameEvent {
  seq += 1;
  id += 1;
  return { id, gameday_id: "g", seq, type, player_id, payload };
}

function reset() {
  seq = 0;
  id = 0;
}

describe("computeGamedayRanking", () => {
  it("ranks non-rebuyers: winner first, reverse elimination order", () => {
    reset();
    // players a,b,c,d. eliminations: c (1st), b (2nd), d (3rd) -> a wins
    const players = ["a", "b", "c", "d"];
    const events = [ev("elimination", "c"), ev("elimination", "b"), ev("elimination", "d")];
    const ranks = computeGamedayRanking(players, events);
    expect(ranks).toEqual([
      { playerId: "a", rank: 1, rebuys: 0 }, // winner (alive)
      { playerId: "d", rank: 2, rebuys: 0 }, // last eliminated
      { playerId: "b", rank: 3, rebuys: 0 },
      { playerId: "c", rank: 4, rebuys: 0 }, // first eliminated
    ]);
  });

  it("places rebuyers after non-rebuyers, first rebuyer last", () => {
    reset();
    const players = ["a", "b", "c"];
    // a never rebuys. b rebuys first, c rebuys second.
    const events = [
      ev("rebuy", "b"),
      ev("rebuy", "c"),
      ev("elimination", "a"), // only non-rebuyer (still ranks first)
    ];
    const ranks = computeGamedayRanking(players, events);
    expect(ranks).toEqual([
      { playerId: "a", rank: 1, rebuys: 0 }, // non-rebuyer first
      { playerId: "c", rank: 2, rebuys: 1 }, // rebuyed later -> better
      { playerId: "b", rank: 3, rebuys: 1 }, // first to rebuy -> last
    ]);
  });

  it("mixed field: non-rebuyers ranked by game, rebuyers by reverse rebuy", () => {
    reset();
    const players = ["w", "x", "y", "z"];
    // y rebuys first, z rebuys second. w and x never rebuy.
    // elimination among non-rebuyers: x eliminated -> w wins
    const events = [
      ev("rebuy", "y"),
      ev("rebuy", "z"),
      ev("elimination", "x"),
    ];
    const ranks = computeGamedayRanking(players, events);
    expect(ranks.map((r) => r.playerId)).toEqual(["w", "x", "z", "y"]);
  });

  it("honours undo of an elimination", () => {
    reset();
    const players = ["a", "b"];
    const elim = ev("elimination", "a");
    const events = [elim, ev("undo", "a", { undoEventId: elim.id })];
    expect(playersRemaining(players, events)).toBe(2);
  });
});

describe("computePayoutRanking", () => {
  it("ranks by pure elimination order, ignoring rebuys", () => {
    reset();
    const players = ["w", "x", "y", "z"];
    // y rebuys first, z rebuys second (ignored for payout).
    // eliminations: y (1st), x (2nd), z (3rd) -> w wins
    const events = [
      ev("rebuy", "y"),
      ev("rebuy", "z"),
      ev("elimination", "y"),
      ev("elimination", "x"),
      ev("elimination", "z"),
    ];
    const ranks = computePayoutRanking(players, events);
    expect(ranks.map((r) => r.rank + ":" + r.playerId)).toEqual([
      "1:w", // winner
      "2:z", // last eliminated (despite rebuy)
      "3:x",
      "4:y", // first eliminated
    ]);
  });

  it("differs from championship ranking for rebuyers", () => {
    reset();
    const players = ["a", "b"];
    // a rebuys first then wins; b never rebuys, eliminated.
    const events = [ev("rebuy", "a"), ev("elimination", "b")];
    // Payout: a survived -> rank 1. Championship: a rebuyed -> ranks last.
    expect(computePayoutRanking(players, events)[0].playerId).toBe("a");
    expect(computeGamedayRanking(players, events)[0].playerId).toBe("b");
  });
});

describe("replayEvents", () => {
  it("tracks rebuys and first rebuy order", () => {
    reset();
    const players = ["a"];
    const state = replayEvents(players, [ev("rebuy", "a"), ev("rebuy", "a")]);
    const a = state.get("a")!;
    expect(a.rebuys).toBe(2);
    expect(a.firstRebuyOrder).toBe(1);
  });
});

describe("rebuyOrderByPlayer", () => {
  it("numbers players by their first active rebuy and ignores undone rebuys", () => {
    reset();
    const players = ["a", "b", "c"];
    const undoneRebuy = ev("rebuy", "c");
    const events = [
      undoneRebuy,
      ev("undo", "c", { undoEventId: undoneRebuy.id }),
      ev("rebuy", "b"),
      ev("rebuy", "a"),
      ev("rebuy", "b"),
    ];

    expect(rebuyOrderByPlayer(players, events)).toEqual(
      new Map([
        ["b", 1],
        ["a", 2],
      ]),
    );
  });
});

describe("totalRebuys & playersRemaining", () => {
  it("counts correctly", () => {
    reset();
    const players = ["a", "b", "c"];
    const events = [ev("rebuy", "a"), ev("rebuy", "a"), ev("elimination", "b")];
    expect(totalRebuys(players, events)).toBe(2);
    expect(playersRemaining(players, events)).toBe(2);
  });
});
