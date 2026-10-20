import type { GamedayRankRow } from "./ranking";

/**
 * Format a compact, copy-pasteable evening summary for WhatsApp.
 *
 * Rebuyers are marked with their rebuy order R1, R2… (order of the first
 * rebuy of the evening, from `rebuyOrderByPlayer`), instead of a bare "(R)".
 */
export function formatWhatsAppResults(
  date: string,
  ranking: GamedayRankRow[],
  playerNames: Record<string, string>,
  sevenTwoCounts: Map<string, number>,
  rebuyOrder: Map<string, number>,
): string {
  const lines = [
    `Résultats du ${date}`,
    ...ranking.map((row, index) => {
      const name = playerNames[row.playerId] ?? row.playerId;
      if (row.rebuys <= 0) return `${index + 1}. ${name}`;
      const order = rebuyOrder.get(row.playerId);
      const rebuyMark =
        order !== undefined ? `(R${order})` : `(R×${row.rebuys})`;
      return `${index + 1}. ${name} ${rebuyMark}`;
    }),
  ];

  const sevenTwoWinners = [...sevenTwoCounts.entries()]
    .filter(([, count]) => count > 0)
    .map(([playerId, count]) => `${playerNames[playerId] ?? playerId} (${count})`);

  if (sevenTwoWinners.length > 0) {
    lines.push("", `7/2 : ${sevenTwoWinners.join(", ")}`);
  }

  return lines.join("\n");
}
