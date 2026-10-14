import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen, within} from '@testing-library/react'
import {PublicStandings} from './PublicStandings'

const mocks = vi.hoisted(() => ({rpc: vi.fn()}))
vi.mock('../lib/supabase', () => ({supabase: mocks}))

describe('PublicStandings', () => {
  beforeEach(() => {
    mocks.rpc.mockResolvedValue({data: {
      season: {start_year: 2026, status: 'open'},
      standings: [{name: 'Ada', points: 10, sessions: [{session_date: '2026-10-01', rank: 1, points: 10}]}],
      seven_two_standings: [],
      session_results: [{
        played_at: '2026-10-01',
        pot: 30,
        payout_table: {},
        players: [
          {name: 'Ada', rank: 1, rebought: false},
          {name: 'Benoit', rank: 2, rebought: true},
        ],
      }],
    }, error: null})
  })

  it('shows player names and marks only rebought players in day results', async () => {
    render(<PublicStandings token="public-token" />)

    const results = await screen.findByRole('heading', {name: 'Résultats des journées'})
    const section = results.closest('section')!
    expect(within(section).getByText(/Ada.*Benoit\s+\(R\)/)).toBeTruthy()
    expect(screen.queryByText(/recave/i)).toBeNull()
  })
})
