import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
      onUndo={async () => {}}
      onCloseSeason={async () => {}}
    />)

    expect(screen.getByText('Ada (2)')).toBeTruthy()
    expect(screen.getByText('Bob (0)')).toBeTruthy()
  })

  it('lets organizer undo an event from the journal', () => {
    const onUndo = vi.fn(async () => {})
    vi.stubGlobal('confirm', () => true)
    render(<GameView
      season={{id: '2026', start_year: 2026, status: 'open'}}
      sessions={[{id: '20261001', season_id: '2026', played_at: '2026-10-01', status: 'open', configuration_snapshot: {buy_in: 10, chips: []}}]}
      selectedSessionId="20261001"
      onSelectSession={() => {}}
      players={[{session_id: '20261001', member_id: 'ada', status: 'eliminated', current_rank: 2, final_rank: 2, first_rebuy_rank: null, member: {id: 'ada', name: 'Ada'}}]}
      events={[{id: 42, sequence_number: 1, event_type: 'elimination', amount: 0, rank_at_event: 2, member: {id: 'ada', name: 'Ada'}}]}
      activeCount={0}
      totalPot={10}
      payouts={null}
      canEdit
      busy={false}
      members={[]}
      onCreateSession={async () => {}}
      onRecord={async () => {}}
      onUndo={onUndo}
      onCloseSeason={async () => {}}
    />)

    fireEvent.click(screen.getByRole('button', {name: 'Annuler élimination de Ada'}))
    expect(onUndo).toHaveBeenCalledWith(42)
    vi.unstubAllGlobals()
  })
})
