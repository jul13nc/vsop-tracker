import type { ChipType } from "../types/domain";

/** Value of a single starting stack. */
export function startingStackValue(chips: ChipType[]): number {
  return chips.reduce((sum, c) => sum + c.value * c.count, 0);
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
