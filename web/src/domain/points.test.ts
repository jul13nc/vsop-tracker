import { describe, expect, it } from "vitest";
import { pointsForRank } from "./points";

const scheme = [10, 7, 5, 3, 2, 1];

describe("pointsForRank", () => {
  it("maps rank to scheme value", () => {
    expect(pointsForRank(1, scheme, false)).toBe(10);
    expect(pointsForRank(6, scheme, false)).toBe(1);
  });

  it("returns 0 beyond scheme length", () => {
    expect(pointsForRank(7, scheme, false)).toBe(0);
    expect(pointsForRank(20, scheme, false)).toBe(0);
  });

  it("doubles when countsDouble", () => {
    expect(pointsForRank(1, scheme, true)).toBe(20);
    expect(pointsForRank(6, scheme, true)).toBe(2);
    expect(pointsForRank(7, scheme, true)).toBe(0);
  });
});
