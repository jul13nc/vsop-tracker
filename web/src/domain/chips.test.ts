import { describe, expect, it } from "vitest";
import { averageStack, startingStackValue, totalChipsInPlay } from "./chips";
import { DEFAULT_CHIP_CONFIG } from "../types/defaults";

describe("chips", () => {
  const stack = startingStackValue(DEFAULT_CHIP_CONFIG);

  it("computes starting stack value", () => {
    // 25*12 + 100*12 + 500*7 = 300 + 1200 + 3500 = 5000
    expect(stack).toBe(5000);
  });

  it("totals chips in play", () => {
    expect(totalChipsInPlay(DEFAULT_CHIP_CONFIG, 6)).toBe(30000);
  });

  it("averages remaining stacks", () => {
    expect(averageStack(DEFAULT_CHIP_CONFIG, 6, 3)).toBe(10000);
    expect(averageStack(DEFAULT_CHIP_CONFIG, 6, 0)).toBe(0);
  });
});
