import type { ChipType } from "../types/domain";

/** Value of a single starting stack. */
export function startingStackValue(chips: ChipType[]): number {
  return chips.reduce((sum, c) => sum + c.value * c.count, 0);
}

// ---------------------------------------------------------------------------
// Chip colors (visual starting-stack display)
// ---------------------------------------------------------------------------

/** Known face colors by chip name (French + English), accent/case-insensitive. */
const NAME_COLORS: Record<string, string> = {
  vert: "#3fae6a",
  green: "#3fae6a",
  noir: "#1d1e22",
  black: "#1d1e22",
  violet: "#7d55c7",
  purple: "#7d55c7",
  rouge: "#cf4f49",
  red: "#cf4f49",
  bleu: "#3d7fd1",
  blue: "#3d7fd1",
  jaune: "#e9c74b",
  yellow: "#e9c74b",
  orange: "#e28b3e",
  blanc: "#f1ede1",
  white: "#f1ede1",
  gris: "#98a19c",
  gray: "#98a19c",
  grey: "#98a19c",
  rose: "#e07ba8",
  pink: "#e07ba8",
  marron: "#8a5a3b",
  brown: "#8a5a3b",
  argent: "#c9cfc9",
  silver: "#c9cfc9",
  or: "#d5b25e",
  gold: "#d5b25e",
  turquoise: "#45c4b0",
  cyan: "#45c4b0",
};

/** Palette cycled when a chip name isn't recognized. */
const FALLBACK_COLORS = [
  "#3fae6a",
  "#cf4f49",
  "#3d7fd1",
  "#e9c74b",
  "#7d55c7",
  "#e28b3e",
  "#e07ba8",
  "#98a19c",
];

function normalizeChipName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Face color of a chip for the visual display:
 *  1. an explicit `color` (hex) in the chip config wins,
 *  2. then the configured name ("Vert", "Noir clair" → vert…),
 *  3. else a fallback palette cycled by index.
 */
export function chipColor(chip: ChipType, index = 0): string {
  if (chip.color) return chip.color;
  const key = normalizeChipName(chip.name);
  return (
    NAME_COLORS[key] ??
    // Match the first word of names like "Vert clair".
    NAME_COLORS[key.split(/[\s-]+/)[0]] ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  );
}

function parseHexColor(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let body = match[1];
  if (body.length === 3) body = body.replace(/./g, (c) => c + c);
  return [
    Number.parseInt(body.slice(0, 2), 16),
    Number.parseInt(body.slice(2, 4), 16),
    Number.parseInt(body.slice(4, 6), 16),
  ];
}

/** Pick a readable text color (near-black or white) for a chip face. */
export function chipTextColor(color: string): string {
  const rgb = parseHexColor(color);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#152016" : "#ffffff";
}

/** Total chip value in play given a number of entries (participants + rebuys). */
export function totalChipsInPlay(chips: ChipType[], entries: number): number {
  return startingStackValue(chips) * entries;
}

/**
 * Average stack of remaining players.
 * entries = participants + rebuys (total stacks distributed).
 */
export function averageStack(
  chips: ChipType[],
  entries: number,
  playersRemaining: number,
): number {
  if (playersRemaining <= 0) return 0;
  return Math.round(totalChipsInPlay(chips, entries) / playersRemaining);
}
