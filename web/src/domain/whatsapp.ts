import type { GamedayRankRow } from "./ranking";

/** Format a compact, copy-pasteable evening summary for WhatsApp. */
export function formatWhatsAppResults(
  date: string,
  ranking: GamedayRankRow[],
  playerNames: Record<string, string>,
  sevenTwoCounts: Map<string, number>,
): string {
  const lines = [
    `Résultats du ${date}`,
    ...ranking.map(
      (row, index) =>
        `${index + 1}. ${playerNames[row.playerId] ?? row.playerId}${row.rebuys > 0 ? " (R)" : ""}`,
    ),
  ];

  const sevenTwoWinners = [...sevenTwoCounts.entries()]
    .filter(([, count]) => count > 0)
    .map(([playerId, count]) => `${playerNames[playerId] ?? playerId} (${count})`);

  if (sevenTwoWinners.length > 0) {
    lines.push("", `7/2 : ${sevenTwoWinners.join(", ")}`);
  }

  return lines.join("\n");
}
