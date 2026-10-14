/**
 * Convert a gameday rank (1-based) into championship points.
 *
 * `scheme[0]` is points for rank 1, `scheme[1]` for rank 2, etc.
 * Ranks beyond the scheme length score 0. When the gameday counts double,
 * points are multiplied by 2.
 */
export function pointsForRank(
  rank: number,
  scheme: number[],
  countsDouble: boolean,
): number {
  const base = scheme[rank - 1] ?? 0;
  return base * (countsDouble ? 2 : 1);
}
