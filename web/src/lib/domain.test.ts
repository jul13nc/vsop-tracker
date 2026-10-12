import { describe, expect, it } from 'vitest'
import { calculatePot, calculateStandings, DEFAULT_PAYOUTS, payoutsFor, seasonLabel, validatePayoutTable } from './domain'

describe('championship calculations', () => {
  it('formats school years as consecutive years', () => {
    expect(seasonLabel(2026)).toBe('2026/2027')
  })

  it('sums entries and rebuys exactly to cents', () => {
    expect(calculatePot(10, 5, [10, 10, 5])).toBe(75)
    expect(calculatePot(10.15, 2, [2.35])).toBe(22.65)
  })

  it('uses exact configured payout and returns null for missing pots', () => {
    expect(payoutsFor(70, DEFAULT_PAYOUTS)).toEqual([{ rank: 1, amount: 40 }, { rank: 2, amount: 20 }, { rank: 3, amount: 10 }])
    expect(payoutsFor(75, DEFAULT_PAYOUTS)).toBeNull()
    expect(validatePayoutTable(DEFAULT_PAYOUTS)).toBe(true)
  })

  it('ranks no-rebuy players first, then rebuy players by latest first rebuy', () => {
    expect(calculateStandings([
      { memberId: 'a', memberName: 'Alex', finalRank: 1, firstRebuySequence: 2, sessionId: 's', sessionDate: '2026-10-01' },
      { memberId: 'b', memberName: 'Bea', finalRank: 2, firstRebuySequence: 1, sessionId: 's', sessionDate: '2026-10-01' },
      { memberId: 'c', memberName: 'Cam', finalRank: 3, firstRebuySequence: null, sessionId: 's', sessionDate: '2026-10-01' },
    ], { '1': 10, '2': 7, '3': 5 }).map((standing) => [standing.name, standing.points, standing.sessions[0].rank])).toEqual([
      ['Cam', 10, 1], ['Alex', 7, 2], ['Bea', 5, 3],
    ])
  })

  it('ranks latest rebuy first when every participant rebought', () => {
    const standings = calculateStandings([
      { memberId: 'a', memberName: 'Alex', finalRank: 1, firstRebuySequence: 1, sessionId: 's', sessionDate: '2026-10-01' },
      { memberId: 'b', memberName: 'Bea', finalRank: 2, firstRebuySequence: 3, sessionId: 's', sessionDate: '2026-10-01' },
      { memberId: 'c', memberName: 'Cam', finalRank: 3, firstRebuySequence: 2, sessionId: 's', sessionDate: '2026-10-01' },
      { memberId: 'd', memberName: 'Dee', finalRank: 4, firstRebuySequence: 5, sessionId: 's', sessionDate: '2026-10-01' },
      { memberId: 'e', memberName: 'Eli', finalRank: 5, firstRebuySequence: 4, sessionId: 's', sessionDate: '2026-10-01' },
    ], { '1': 10, '2': 7, '3': 5, '4': 3, '5': 2 })

    expect(standings.map(({ memberId, sessions }) => [memberId, sessions[0].rank])).toEqual([
      ['d', 1], ['e', 2], ['b', 3], ['c', 4], ['a', 5],
    ])
  })

  it('does not award annual points before a session is finished', () => {
    expect(calculateStandings([
      { memberId:'a',memberName:'Alex',finalRank:null,firstRebuySequence:4,sessionId:'s',sessionDate:'2026-10-01' },
    ], { '4':3 })).toEqual([])
  })
})
