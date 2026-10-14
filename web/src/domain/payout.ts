import type { PayoutTable } from "../types/domain";

/**
 * Total amount bet in euros = (participants + rebuys) * buyin.
 * buyinCents is the season's buy-in; result is in euros.
 */
export function totalBetEuros(
  participantCount: number,
  rebuyCount: number,
  buyinCents: number,
): number {
  const entries = participantCount + rebuyCount;
  return (entries * buyinCents) / 100;
}

export interface PayoutRow {
  rank: number;
  amount: number;
}

/**
 * Resolve the payout distribution for a given total bet.
 *
 * Totals are guaranteed to be multiples of the buy-in (10€), so the key must
 * match exactly. Throws if the total is not present in the table.
 */
export function resolvePayout(
  totalBet: number,
  table: PayoutTable,
): PayoutRow[] {
  const key = String(totalBet);
  const dist = table[key];
  if (!dist) {
    throw new PayoutNotFoundError(totalBet, Object.keys(table));
  }
  return Object.entries(dist)
    .map(([rank, amount]) => ({ rank: Number(rank), amount }))
    .sort((a, b) => a.rank - b.rank);
}

/** Number of payout positions configured for the exact total bet. */
export function paidPlacesForTotal(totalBet: number, table: PayoutTable): number {
  return Object.keys(table[String(totalBet)] ?? {}).length;
}

export class PayoutNotFoundError extends Error {
  constructor(
    public total: number,
    public availableKeys: string[],
  ) {
    super(
      `Aucun payout défini pour un total de ${total}€. ` +
        `Tranches disponibles: ${availableKeys.join(", ")}.`,
    );
    this.name = "PayoutNotFoundError";
  }
}
