import { describe, expect, it } from 'vitest'
import { DEFAULT_CHIPS, DEFAULT_PAYOUTS, DEFAULT_POINTS, calculateStandings, payoutsFor } from './domain'

describe('season defaults', () => {
  it('contains requested starting chips and payout schedule', () => {
    expect(DEFAULT_CHIPS).toEqual([
      { label: 'Vert', value: 25, quantity: 12 },
      { label: 'Noir', value: 100, quantity: 12 },
      { label: 'Violet', value: 500, quantity: 7 },
    ])
    expect(Object.keys(DEFAULT_PAYOUTS)).toEqual(['50','60','70','80','90','100','110','120','130','140'])
    for (const [pot, payouts] of Object.entries(DEFAULT_PAYOUTS)) {
      expect(payoutsFor(Number(pot), DEFAULT_PAYOUTS)?.map(({ amount }) => amount)).toEqual(Object.values(payouts))
    }
  })

  it('adds points across finished sessions using rank by rebuy sequence', () => {
    const standings = calculateStandings([
      { memberId:'m1',memberName:'Camille',finalRank:1,firstRebuySequence:4,sessionId:'s1',sessionDate:'2026-10-01' },
      { memberId:'m1',memberName:'Camille',finalRank:2,firstRebuySequence:null,sessionId:'s2',sessionDate:'2026-11-01' },
    ], DEFAULT_POINTS)
    expect(standings[0].points).toBe(20)
    expect(standings[0].sessions.map((row)=>row.rank)).toEqual([1,1])
  })
})
