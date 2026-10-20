import { describe, expect, it } from "vitest";
import {
  averageStack,
  chipColor,
  chipTextColor,
  startingStackValue,
  totalChipsInPlay,
} from "./chips";
import { DEFAULT_CHIP_CONFIG } from "../types/defaults";
import type { ChipType } from "../types/domain";

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

describe("chip colors", () => {
  const chip = (name: string, color?: string): ChipType => ({
    name,
    value: 25,
    count: 12,
    ...(color ? { color } : {}),
  });

  it("maps the default config names to their colors", () => {
    expect(chipColor(chip("Vert"))).toBe("#3fae6a");
    expect(chipColor(chip("Noir"))).toBe("#1d1e22");
    expect(chipColor(chip("Violet"))).toBe("#7d55c7");
  });

  it("is case/whitespace-insensitive and matches the first word", () => {
    expect(chipColor(chip("  Rouge "))).toBe("#cf4f49");
    expect(chipColor(chip("Vert clair"))).toBe("#3fae6a");
    expect(chipColor(chip("Bleu-nuit"))).toBe("#3d7fd1");
  });

  it("prefers an explicitly configured color", () => {
    expect(chipColor(chip("Vert", "#123456"))).toBe("#123456");
  });

  it("falls back to a palette cycled by index", () => {
    const unknown = chip("Inconnu");
    expect(chipColor(unknown, 0)).toBe(chipColor(unknown, 8));
    expect(chipColor(unknown, 0)).not.toBe(chipColor(unknown, 1));
  });

  it("picks readable text for light and dark faces", () => {
    expect(chipTextColor("#000000")).toBe("#ffffff");
    expect(chipTextColor("#ffffff")).toBe("#152016");
    expect(chipTextColor("#e9c74b")).toBe("#152016"); // jaune
    expect(chipTextColor("#1d1e22")).toBe("#ffffff"); // noir
    expect(chipTextColor("#3fae6a")).toBe("#ffffff"); // vert
  });

  it("falls back to white text on an invalid color", () => {
    expect(chipTextColor("not-a-color")).toBe("#ffffff");
  });
});
