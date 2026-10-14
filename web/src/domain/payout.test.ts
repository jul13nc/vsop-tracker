import { describe, expect, it } from "vitest";
import {
  paidPlacesForTotal,
  PayoutNotFoundError,
  resolvePayout,
  totalBetEuros,
} from "./payout";
import { DEFAULT_PAYOUT_TABLE } from "../types/defaults";

describe("totalBetEuros", () => {
  it("computes entries * buyin in euros", () => {
    expect(totalBetEuros(5, 0, 1000)).toBe(50);
    expect(totalBetEuros(5, 2, 1000)).toBe(70);
  });
});

describe("resolvePayout", () => {
  it("resolves exact key sorted by rank", () => {
    expect(resolvePayout(70, DEFAULT_PAYOUT_TABLE)).toEqual([
      { rank: 1, amount: 40 },
      { rank: 2, amount: 20 },
      { rank: 3, amount: 10 },
    ]);
  });

  it("throws on missing key", () => {
    expect(() => resolvePayout(55, DEFAULT_PAYOUT_TABLE)).toThrow(
      PayoutNotFoundError,
    );
  });
});

describe("paidPlacesForTotal", () => {
  it("counts configured paid ranks for the exact total", () => {
    expect(paidPlacesForTotal(50, DEFAULT_PAYOUT_TABLE)).toBe(2);
    expect(paidPlacesForTotal(70, DEFAULT_PAYOUT_TABLE)).toBe(3);
  });

  it("returns zero when total has no payout configuration", () => {
    expect(paidPlacesForTotal(150, DEFAULT_PAYOUT_TABLE)).toBe(0);
  });
});
