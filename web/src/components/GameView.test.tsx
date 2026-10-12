import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameView } from './GameView'

describe('GameView player list', () => {
  it('shows each player 7/2 win count in parentheses', () => {
    render(<GameView
      season={{ id: 'season-1', start_year: 2026, status: 'open' }}
      sessions={[{ id: 'session-1', season_id: 'season-1', played_at: '2026-10-01', status: 'open', configuration_snapshot: { buy_in: 10, chips: [] } }]}
      selectedSessionId="session-1"
      onSelectSession={() => {}}
      players={[
        { session_id: 'session-1', member_id: 'ada', status: 'active', current_rank: null, final_rank: null, first_rebuy_rank: null, member: { id: 'ada', name: 'Ada' } },
        { session_id: 'session-1', member_id: 'bob', status: 'active', current_rank: null, final_rank: null, first_rebuy_rank: null, member: { id: 'bob', name: 'Bob' } },
      ]}
      events={[
        { id: 1, sequence_number: 1, event_type: 'seven_two', amount: 0, rank_at_event: null, member: { id: 'ada', name: 'Ada' } },
        { id: 2, sequence_number: 2, event_type: 'seven_two', amount: 0, rank_at_event: null, member: { id: 'ada', name: 'Ada' } },
      ]}
      activeCount={2}
      totalPot={20}
      payouts={null}
      canEdit={false}
      busy={false}
      members={[]}
      onCreateSession={async () => {}}
      onRecord={async () => {}}
      onCloseSeason={async () => {}}
    />)

    expect(screen.getByText('Ada (2)')).toBeTruthy()
    expect(screen.getByText('Bob (0)')).toBeTruthy()
  })
})
