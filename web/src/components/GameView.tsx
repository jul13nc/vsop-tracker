import {useState} from 'react'
import {DEFAULT_CHIPS, seasonLabel} from '../lib/domain'

type GameSession = {
    id: string;
    season_id: string;
    played_at: string;
    status: 'open' | 'finished';
    configuration_snapshot: { buy_in: number; chips: typeof DEFAULT_CHIPS }
}
type Player = {
    session_id: string;
    member_id: string;
    status: 'active' | 'eliminated';
    current_rank: number | null;
    final_rank: number | null;
    first_rebuy_rank: number | null;
    member: { id: string; name: string }
}
type Event = {
    id: number;
    sequence_number: number;
    event_type: 'rebuy' | 'elimination' | 'seven_two';
    amount: number;
    rank_at_event: number | null;
    member: { id: string; name: string }
}
type Props = {
    season: { id: string; start_year: number; status: 'open' | 'closed' };
    sessions: GameSession[];
    selectedSessionId: string;
    onSelectSession: (id: string) => void
    players: Player[];
    events: Event[];
    activeCount: number;
    totalPot: number;
    payouts: { rank: number; amount: number }[] | null;
    canEdit: boolean;
    busy: boolean
    members: { id: string; name: string }[];
    onCreateSession: (form: { playedAt: string; memberIds: string[] }) => Promise<void>;
    onRecord: (memberId: string, type: Event['event_type']) => Promise<void>;
    onUndo: (eventId: number) => Promise<void>;
    onCloseSeason: () => Promise<void>
}

export function GameView(props: Props) {
    const {
        season,
        sessions,
        selectedSessionId,
        onSelectSession,
        players,
        events,
        activeCount,
        totalPot,
        payouts,
        canEdit,
        busy,
        members,
        onCreateSession,
        onRecord,
        onUndo,
        onCloseSeason
    } = props
    const [creating, setCreating] = useState(false);
    const [playedAt, setPlayedAt] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([])
    const game = sessions.find((item) => item.id === selectedSessionId)
    const orderedPlayers = players.slice().sort((a, b) => a.status === b.status ? (a.current_rank ?? 999) - (b.current_rank ?? 999) || a.member.name.localeCompare(b.member.name) : a.status === 'active' ? -1 : 1)
    const sevenTwoCounts = new Map<string, number>()
    for (const event of events) {
        if (event.event_type === 'seven_two') sevenTwoCounts.set(event.member.id, (sevenTwoCounts.get(event.member.id) ?? 0) + 1)
    }

    function toggleMember(id: string) {
        setSelectedMembers((current) => current.includes(id) ? current.filter((memberId) => memberId !== id) : [...current, id])
    }

    async function create() {
        await onCreateSession({playedAt, memberIds: selectedMembers});
        setCreating(false);
        setSelectedMembers([]);
        setPlayedAt(new Date().toISOString().slice(0, 10))
    }

    return <section className="game-layout">
        <div className="game-main">
            <div className="section-title game-heading">
                <div><p className="eyebrow">{seasonLabel(season.start_year)} · CHAMPIONNAT</p><h1>La table</h1></div>
                {canEdit && <button className="secondary-button"
                                    onClick={() => setCreating(!creating)}>{creating ? 'Annuler' : '+ Journée'}</button>}
            </div>
            {creating &&
                <section className="create-session"><label>Date de la journée<input type="date" value={playedAt}
                                                                                    onChange={(event) => setPlayedAt(event.target.value)}/></label>
                    <p className="eyebrow">PARTICIPANTS ({selectedMembers.length})</p>{members.length === 0 ?
                        <p className="empty-copy">Ajoutez d’abord les membres depuis onglet Membres.</p> :
                        <div className="member-picker">{members.map((member) => <button type="button" key={member.id}
                                                                                        className={selectedMembers.includes(member.id) ? 'selected' : ''}
                                                                                        onClick={() => toggleMember(member.id)}>
                            <span>{selectedMembers.includes(member.id) ? '✓' : '+'}</span>{member.name}
                        </button>)}</div>}
                    <button className="primary-button" disabled={busy || !selectedMembers.length || !playedAt}
                            onClick={() => void create()}>Créer la journée →
                    </button>
                </section>}
            {sessions.length > 0 && <label className="session-select">JOURNÉE<select value={selectedSessionId}
                                                                                     onChange={(event) => onSelectSession(event.target.value)}>{sessions.map((item) =>
                <option key={item.id}
                        value={item.id}>{new Date(`${item.played_at}T12:00:00`).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                })} · {item.status === 'open' ? 'En cours' : 'Terminée'}</option>)}</select></label>}
            {!game ? <div className="empty-table"><span>♠</span><h2>Les sièges sont libres.</h2>
                <p>{canEdit ? 'Créez une journée et sélectionnez les membres présents.' : 'Aucune journée disponible pour cette saison.'}</p>{canEdit &&
                    <button className="primary-button" onClick={() => {
                        setPlayedAt(new Date().toISOString().slice(0, 10));
                        setCreating(true)
                    }}>Préparer une journée →</button>}</div> : <>
                <div className="game-status"><span
                    className={game.status === 'open' ? 'live-indicator' : 'finished-indicator'}>● {game.status === 'open' ? 'EN DIRECT' : 'TERMINÉE'}</span><span>{new Date(`${game.played_at}T12:00:00`).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                })}</span><strong>{activeCount}<small> EN JEU</small></strong></div>
                <div className="pot-card">
                    <div><strong>{new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                    }).format(totalPot)}</strong></div>
                    <div className="payout-info"><small>{payouts ? 'RÉPARTITION' : 'PAYOUT'}</small>{payouts ?
                        <span>{payouts.map((item) => `${item.rank}e ${item.amount}€`).join('  ·  ')}</span> :
                        <span className="not-configured">Montant non configuré</span>}</div>
                </div>
                <section className="chips-card"><p className="eyebrow">DOTATION DE DÉPART · PAR JOUEUR</p>
                    <div className="chip-list">{(game.configuration_snapshot.chips ?? DEFAULT_CHIPS).map((chip) => <div
                        className="chip" key={chip.label}><span
                        className={`chip-visual chip-${chip.label.toLowerCase()}`}>{chip.value}</span>
                        <div><strong>{chip.quantity} jetons</strong>
                        </div>
                    </div>)}</div>
                </section>
                <div className="players-heading"><h2>Joueurs</h2><span>{players.length} inscrits</span></div>
                <div className="players-list">{orderedPlayers.map((player) => <article
                    className={`player-card ${player.status === 'eliminated' ? 'out' : ''}`} key={player.member_id}>
                    <div className="player-person"><span
                        className="avatar">{player.member.name.slice(0, 1).toUpperCase()}</span>
                        <div>
                            <strong>{player.member.name} ({sevenTwoCounts.get(player.member_id) ?? 0})</strong><small>{player.status === 'active' ? 'EN JEU' : `${player.final_rank ?? player.current_rank}e place`}{player.first_rebuy_rank ? ` · rang recave ${player.first_rebuy_rank}e` : ''}</small>
                        </div>
                    </div>
                    <div
                        className="player-actions">{canEdit && game.status === 'open' && (player.status === 'active' ? <>
                        <button aria-label={`Enregistrer 7/2 pour ${player.member.name}`} title="Main gagnée avec 7/2"
                                className="seven-two-button" disabled={busy}
                                onClick={() => void onRecord(player.member_id, 'seven_two')}>7/2
                        </button>
                        <button className="danger-button" disabled={busy || activeCount <= 1}
                                onClick={() => void onRecord(player.member_id, 'elimination')}>Éliminer
                        </button>
                    </> : <button className="rebuy-button" disabled={busy}
                                  onClick={() => void onRecord(player.member_id, 'rebuy')}>+ Recave</button>)}</div>
                </article>)}</div>
                {canEdit && game.status === 'open' &&
                    <p className="quick-hint">Une recave enregistre le rang actuel pour classement et réactive
                        joueur.</p>}
                <section className="event-panel">
                    <div className="players-heading"><h2>Journal de soirée</h2><span>{events.length} événements</span>
                    </div>
                    {events.length === 0 ? <p className="empty-copy">Aucun événement enregistré.</p> :
                        <ol className="event-list">{events.slice().reverse().map((event) => <li key={event.id}><span
                            className={`event-symbol event-${event.event_type}`}>{event.event_type === 'rebuy' ? '↻' : event.event_type === 'elimination' ? '×' : '7/2'}</span><span><strong>{event.member.name}</strong><small>{event.event_type === 'rebuy' ? 'Recave' : event.event_type === 'elimination' ? `Élimination · ${event.rank_at_event}e` : 'Main remportée avec 7/2'}</small></span>
                            <time>#{event.sequence_number}</time>
                            {canEdit && <button className="secondary-button event-undo" disabled={busy}
                                aria-label={`Annuler ${event.event_type === 'rebuy' ? 'recave' : event.event_type === 'elimination' ? 'élimination' : '7/2'} de ${event.member.name}`}
                                onClick={() => {
                                    if (confirm(`Annuler cette action de ${event.member.name} ? Les actions suivantes seront recalculées.`)) void onUndo(event.id)
                                }}>Annuler</button>}
                        </li>)}</ol>}</section>
            </>}
            {canEdit && season.status === 'open' && sessions.length > 0 &&
                <button className="close-season" onClick={() => void onCloseSeason()}>Clôturer la saison et
                    archiver</button>}
        </div>
        <aside className="game-aside"><p className="eyebrow">CHAMPIONNAT</p><h2>Chaque main compte.</h2><p>Vos soirées,
            vos règles, une saison entière dans un seul classement.</p>
            <div className="aside-stats">
                <span>SAISON</span><strong>{seasonLabel(season.start_year)}</strong><span>JOURNÉES</span><strong>{sessions.length}</strong><span>MEMBRES</span><strong>{members.length}</strong>
            </div>
        </aside>
    </section>
}
