export type Chip = { label: string; value: number; quantity: number }
export type PayoutTable = Record<string, Record<string, number>>
export type StandingInput = {
  memberId: string
  memberName: string
  finalRank: number | null
  firstRebuySequence: number | null
  sessionId: string
  sessionDate: string
}

export type PublicStandingInput = {
  memberId: string
  memberName: string
  sessionId: string
  sessionDate: string
  finalRank: number | null
  rebuySequences: number[]
}

export type SevenTwoInput = { memberId: string; memberName: string }

export const DEFAULT_CHIPS: Chip[] = [
  { label: 'Vert', value: 25, quantity: 12 },
  { label: 'Noir', value: 100, quantity: 12 },
  { label: 'Violet', value: 500, quantity: 7 },
]

export const DEFAULT_PAYOUTS: PayoutTable = {
  '50': { '1': 30, '2': 20 }, '60': { '1': 40, '2': 20 },
  '70': { '1': 40, '2': 20, '3': 10 }, '80': { '1': 40, '2': 30, '3': 10 },
  '90': { '1': 50, '2': 30, '3': 10 }, '100': { '1': 60, '2': 30, '3': 10 },
  '110': { '1': 70, '2': 30, '3': 10 }, '120': { '1': 70, '2': 40, '3': 10 },
  '130': { '1': 80, '2': 40, '3': 10 }, '140': { '1': 90, '2': 40, '3': 10 },
}

export const DEFAULT_POINTS: Record<string, number> = { '1': 10, '2': 7, '3': 5, '4': 3, '5': 2, '6': 1 }

export function seasonLabel(startYear: number) {
  return `${startYear}/${startYear + 1}`
}

export function calculatePot(buyIn: number, participants: number, rebuyAmounts: number[]) {
  const cents = Math.round(buyIn * 100) * participants + rebuyAmounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0)
  return cents / 100
}

export function payoutsFor(total: number, table: PayoutTable) {
  const row = table[String(Math.round(total * 100) / 100)]
  if (!row) return null
  const places = Object.entries(row).map(([rank, amount]) => ({ rank: Number(rank), amount: Number(amount) })).sort((a, b) => a.rank - b.rank)
  if (!places.length || places.some((place, index) => place.rank !== index + 1) || Math.round(places.reduce((sum, place) => sum + place.amount, 0) * 100) !== Math.round(total * 100)) return null
  return places
}

export function calculateStandings(results: StandingInput[], pointsByRank: Record<string, number>) {
  const totals = new Map<string, { memberId: string; name: string; points: number; sessions: Array<{ sessionId: string; sessionDate: string; rank: number; points: number; rebought: boolean }> }>()
  const finishedBySession = new Map<string, StandingInput[]>()
  for (const result of results) {
    if (result.finalRank === null) continue
    const session = finishedBySession.get(result.sessionId) ?? []
    session.push(result)
    finishedBySession.set(result.sessionId, session)
  }

  for (const [sessionId, sessionResults] of finishedBySession) {
    const playersWithoutRebuy = sessionResults
      .filter((result) => result.firstRebuySequence === null)
      .sort((a, b) => (a.finalRank ?? Number.MAX_SAFE_INTEGER) - (b.finalRank ?? Number.MAX_SAFE_INTEGER))
    const rankByMember = new Map(playersWithoutRebuy.map((result, index) => [result.memberId, index + 1]))
    const playersWithRebuy = sessionResults
      .filter((result) => result.firstRebuySequence !== null)
      .sort((a, b) => (b.firstRebuySequence ?? 0) - (a.firstRebuySequence ?? 0))
    playersWithRebuy.forEach((result, index) => rankByMember.set(result.memberId, playersWithoutRebuy.length + index + 1))

    for (const result of sessionResults) {
      const rank = rankByMember.get(result.memberId)
      if (rank === undefined) continue
      const points = Number(pointsByRank[String(rank)] ?? 0)
      const standing = totals.get(result.memberId) ?? { memberId: result.memberId, name: result.memberName, points: 0, sessions: [] }
      standing.points += points
      standing.sessions.push({ sessionId, sessionDate: result.sessionDate, rank, points, rebought: result.firstRebuySequence !== null })
      totals.set(result.memberId, standing)
    }
  }
  return [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
}

export function publicStandings(results: PublicStandingInput[], pointsByRank: Record<string, number>) {
  const sessions = new Map<string, PublicStandingInput[]>()
  for (const result of results) {
    const rows = sessions.get(result.sessionId) ?? []
    rows.push(result)
    sessions.set(result.sessionId, rows)
  }

  const projected: StandingInput[] = []
  for (const [sessionId, rows] of sessions) {
    const withoutRebuy = rows
      .filter((row) => row.rebuySequences.length === 0 && row.finalRank !== null)
      .sort((a, b) => (a.finalRank ?? Infinity) - (b.finalRank ?? Infinity))
    const ranked = new Map<string, number>(withoutRebuy.map((row, index) => [row.memberId, index + 1]))
    const withRebuy = rows
      .filter((row) => row.rebuySequences.length > 0 && row.finalRank !== null)
      .sort((a, b) => Math.max(...b.rebuySequences) - Math.max(...a.rebuySequences))
    withRebuy.forEach((row, index) => ranked.set(row.memberId, withoutRebuy.length + index + 1))

    for (const row of rows) {
      const rank = ranked.get(row.memberId)
      if (rank === undefined || row.finalRank === null) continue
      projected.push({
        memberId: row.memberId,
        memberName: row.memberName,
        sessionId,
        sessionDate: row.sessionDate,
        finalRank: rank,
        firstRebuySequence: row.rebuySequences.length ? Math.min(...row.rebuySequences) : null,
      })
    }
  }
  return calculateStandings(projected, pointsByRank)
}

export function calculateSevenTwoStandings(results: SevenTwoInput[]) {
  const counts = new Map<string, { memberId: string; name: string; wins: number }>()
  for (const result of results) {
    const row = counts.get(result.memberId) ?? { memberId: result.memberId, name: result.memberName, wins: 0 }
    row.wins += 1
    counts.set(result.memberId, row)
  }
  return [...counts.values()].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name))
}

export function validatePayoutTable(table: PayoutTable) {
  for (const [pot, ranks] of Object.entries(table)) {
    const total = Number(pot)
    const places = Object.entries(ranks).map(([rank, amount]) => [Number(rank), Number(amount)] as const).sort((a, b) => a[0] - b[0])
    if (!Number.isFinite(total) || total <= 0 || !places.length) return false
    if (places.some(([rank, amount], index) => rank !== index + 1 || !Number.isFinite(amount) || amount < 0)) return false
    if (Math.round(places.reduce((sum, [, amount]) => sum + amount, 0) * 100) !== Math.round(total * 100)) return false
  }
  return true
}
