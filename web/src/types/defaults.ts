import type { BlindLevel, ChipType, PayoutTable } from "./domain";

export const DEFAULT_BUYIN_CENTS = 1000;

export const DEFAULT_PAYOUT_TABLE: PayoutTable = {
  "50": { "1": 30, "2": 20 },
  "60": { "1": 40, "2": 20 },
  "70": { "1": 40, "2": 20, "3": 10 },
  "80": { "1": 40, "2": 30, "3": 10 },
  "90": { "1": 50, "2": 30, "3": 10 },
  "100": { "1": 60, "2": 30, "3": 10 },
  "110": { "1": 70, "2": 30, "3": 10 },
  "120": { "1": 70, "2": 40, "3": 10 },
  "130": { "1": 80, "2": 40, "3": 10 },
  "140": { "1": 90, "2": 40, "3": 10 },
};

export const DEFAULT_CHIP_CONFIG: ChipType[] = [
  { name: "Vert", value: 25, count: 12 },
  { name: "Noir", value: 100, count: 12 },
  { name: "Violet", value: 500, count: 7 },
];

export const DEFAULT_POINTS_SCHEME: number[] = [10, 7, 5, 3, 2, 1];

export const DEFAULT_BLIND_LEVEL_MINUTES = 20;

export const DEFAULT_BLIND_STRUCTURE: BlindLevel[] = [
  { level: 1, small: 25, big: 50 },
  { level: 2, small: 50, big: 100 },
  { level: 3, small: 75, big: 150 },
  { level: 4, small: 100, big: 200 },
  { level: 5, small: 150, big: 300 },
  { level: 6, small: 200, big: 400 },
  { level: 7, small: 300, big: 600 },
  { level: 8, small: 400, big: 800 },
  { level: 9, small: 500, big: 1000 },
  { level: 10, small: 700, big: 1400 },
];
