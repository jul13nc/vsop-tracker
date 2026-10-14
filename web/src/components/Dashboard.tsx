import {useCallback, useEffect, useMemo, useState} from 'react'
import type {Session as AuthSession} from '@supabase/supabase-js'
import {supabase, type SupabaseClient} from '../lib/supabase'
import type {PublicStandingInput} from '../lib/domain'
import {
    calculatePot,
    calculateSevenTwoStandings,
    calculateStandings,
    DEFAULT_CHIPS,
    DEFAULT_PAYOUTS,
    DEFAULT_POINTS,
    payoutsFor,
    type PayoutTable,
    seasonLabel
} from '../lib/domain'
import {GameView} from './GameView'
import {SettingsView} from './SettingsView'

type Role = 'organizer' | 'reader' | null
type Season = { id: string; start_year: number; status: 'open' | 'closed' }
type Member = { id: string; name: string }
type Config = {
    season_id: string;
    buy_in: number;
    chips: typeof DEFAULT_CHIPS;
    payout_table: PayoutTable;
    points_by_rank: Record<string, number>
}
type SessionRow = {
    id: string;
    season_id: string;
    played_at: string;
    status: 'open' | 'finished';
    configuration_snapshot: Config
}
type Player = {
    session_id: string;
    member_id: string;
    status: 'active' | 'eliminated';
    current_rank: number | null;
    final_rank: number | null;
    first_rebuy_rank: number | null;
    member: Member
}
type Event = {
    id: number;
    session_id: string;
    member_id: string;
    sequence_number: number;
    event_type: 'rebuy' | 'elimination' | 'seven_two';
    amount: number;
    rank_at_event: number | null;
    member: Member
}

const client = supabase as SupabaseClient

export function Dashboard({session}: { session: AuthSession }) {
    const [role, setRole] = useState<Role>(null)
    const [profileLoaded, setProfileLoaded] = useState(false)
    const [seasons, setSeasons] = useState<Season[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState('')
    const [tab, setTab] = useState<'game' | 'standings' | 'members' | 'settings'>('game')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [newMember, setNewMember] = useState('')
    const [newYear, setNewYear] = useState('2026')
    const [creatingSeason, setCreatingSeason] = useState(false)
    const [sessions, setSessions] = useState<SessionRow[]>([])
    const [selectedSessionId, setSelectedSessionId] = useState('')
    const [configuration, setConfiguration] = useState<Config | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [standings, setStandings] = useState<ReturnType<typeof calculateStandings>>([])
    const [sevenTwoStandings, setSevenTwoStandings] = useState<ReturnType<typeof calculateSevenTwoStandings>>([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [publicLink, setPublicLink] = useState('')

    const canEdit = role === 'organizer' && seasons.find((season) => season.id === selectedSeasonId)?.status === 'open'
    const activeCount = players.filter((player) => player.status === 'active').length
    const totalPot = useMemo(() => {
        if (!selectedSessionId) return 0
        const game = sessions.find((item) => item.id === selectedSessionId)
        if (!game) return 0
        const rebuys = events.filter((event) => event.event_type === 'rebuy').map((event) => Number(event.amount))
        return calculatePot(Number(game.configuration_snapshot.buy_in), players.length, rebuys)
    }, [events, players.length, selectedSessionId, sessions])
    const payoutTable = sessions.find((item) => item.id === selectedSessionId)?.configuration_snapshot.payout_table ?? DEFAULT_PAYOUTS
    const payouts = payoutsFor(totalPot, payoutTable)

    useEffect(() => {
        let alive = true
        void client.from('profiles').select('role').eq('user_id', session.user.id).single().then(({
                                                                                                      data,
                                                                                                      error: profileError
                                                                                                  }) => {
            if (!alive) return
            if (profileError) setError('Votre compte ne dispose pas d’une invitation valide.')
            setRole((data?.role as Role) ?? null)
            setProfileLoaded(true)
        })
        return () => {
            alive = false
        }
    }, [session.user.id])

    const loadBase = useCallback(async () => {
        setError('')
        const [seasonResult, memberResult] = await Promise.all([
            client.from('seasons').select('id,start_year,status').order('start_year', {ascending: false}),
            client.from('members').select('id,name').order('name'),
        ])
        if (seasonResult.error || memberResult.error) {
            setError(seasonResult.error?.message ?? memberResult.error?.message ?? 'Chargement impossible.')
            return
        }
        const nextSeasons = ((seasonResult.data ?? []) as Season[]).map((season) => ({
            ...season,
            id: String(season.id),
        }))
        setSeasons(nextSeasons)
        setMembers((memberResult.data ?? []) as Member[])
        if (nextSeasons[0]) setSelectedSeasonId((current) => current || nextSeasons[0].id)
    }, [])

    const loadSessions = useCallback(async (seasonId = selectedSeasonId, preferredSessionId?: string) => {
        if (!seasonId) return
        const {data, error: sessionsError} = await client.from('sessions')
            .select('id,season_id,played_at,status,configuration_snapshot')
            .eq('season_id', seasonId)
            .order('played_at', {ascending: false})
        if (sessionsError) {
            setError(sessionsError.message);
            return
        }
        const nextSessions = (data ?? []) as SessionRow[]
        setSessions(nextSessions)
        setSelectedSessionId((current) => {
            if (preferredSessionId && nextSessions.some((item) => item.id === preferredSessionId)) return preferredSessionId
            return current && nextSessions.some((item) => item.id === current) ? current : nextSessions[0]?.id ?? ''
        })
    }, [selectedSeasonId])

    useEffect(() => {
        if (profileLoaded && role) void loadBase()
        // Load catalog once after profile authorization is resolved.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileLoaded, role])

    useEffect(() => {
        if (!selectedSeasonId) return
        let alive = true
        void client.from('season_configurations').select('*').eq('season_id', selectedSeasonId).single().then((configResult) => {
            if (!alive) return
            if (configResult.error) setError(configResult.error.message)
            setConfiguration(configResult.data as Config | null)
        })
        return () => {
            alive = false
        }
    }, [selectedSeasonId])

    useEffect(() => {
        void loadSessions(selectedSeasonId)
    }, [selectedSeasonId, loadSessions])

    const loadGame = useCallback(async () => {
        if (!selectedSessionId) {
            setPlayers([]);
            setEvents([]);
            return
        }
        const [playerResult, eventResult] = await Promise.all([
            client.from('session_players').select('*,member:members(id,name)').eq('session_id', selectedSessionId),
            client.from('session_events').select('*').eq('session_id', selectedSessionId).order('sequence_number'),
        ])
        if (playerResult.error || eventResult.error) {
            setError(playerResult.error?.message ?? eventResult.error?.message ?? 'Chargement de partie impossible.');
            return
        }
        const nextPlayers = (playerResult.data ?? []) as unknown as Player[]
        const memberById = new Map(nextPlayers.map((player) => [player.member_id, player.member]))
        setPlayers(nextPlayers)
        setEvents(((eventResult.data ?? []) as Omit<Event, 'member'>[]).map((event) => ({
            ...event,
            member: memberById.get(event.member_id) ?? {id: event.member_id, name: 'Membre inconnu'},
        })))
    }, [selectedSessionId])

    useEffect(() => {
        if (selectedSessionId) void loadGame()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSessionId])
    useEffect(() => {
        const channel = client.channel('championship-updates')
            .on('postgres_changes', {event: '*', schema: 'public', table: 'session_events'}, () => {
                void loadGame()
            })
            .on('postgres_changes', {event: '*', schema: 'public', table: 'session_players'}, () => {
                void loadGame()
            })
            .on('postgres_changes', {event: '*', schema: 'public', table: 'sessions'}, () => {
                void loadSessions(selectedSeasonId)
            })
            .subscribe()
        return () => {
            void client.removeChannel(channel)
        }
    }, [loadGame, loadSessions, selectedSessionId, selectedSeasonId])

    const loadStandings = useCallback(async () => {
        if (!selectedSeasonId) {
            setStandings([]);
            return
        }
        const [sessionResult, configResult] = await Promise.all([
            client.from('sessions').select('id,played_at,session_players(member_id,final_rank,member:members(name))').eq('season_id', selectedSeasonId),
            client.from('season_configurations').select('points_by_rank').eq('season_id', selectedSeasonId).single(),
        ])
        if (sessionResult.error || configResult.error) {
            setError(sessionResult.error?.message ?? configResult.error?.message ?? 'Classement indisponible.');
            return
        }
        const games = sessionResult.data ?? []
        const gameIds = games.map((game) => game.id)
        const [eventResult, sevenTwoResult] = gameIds.length ? await Promise.all([
            client.from('session_events').select('session_id,member_id,event_type,sequence_number').in('session_id', gameIds).eq('event_type', 'rebuy'),
            client.from('session_events').select('session_id,member_id').in('session_id', gameIds).eq('event_type', 'seven_two'),
        ]) : [{data: [], error: null}, {data: [], error: null}]
        if (eventResult.error) {
            setError(eventResult.error.message);
            return
        }
        const firstRebuyBySessionAndPlayer = new Map<string, number>()
        for (const event of eventResult.data ?? []) {
            const key = `${event.session_id}:${event.member_id}`
            const previous = firstRebuyBySessionAndPlayer.get(key)
            if (previous === undefined || event.sequence_number < previous) firstRebuyBySessionAndPlayer.set(key, event.sequence_number)
        }
        const rows = games.flatMap((game) => {
            return (game.session_players as unknown as Array<{
                member_id: string;
                final_rank: number | null;
                member: { name: string } | null
            }>)
                .filter((player) => player.member)
                .map((player) => ({
                    memberId: player.member_id,
                    memberName: player.member!.name,
                    finalRank: player.final_rank,
                    firstRebuySequence: firstRebuyBySessionAndPlayer.get(`${game.id}:${player.member_id}`) ?? null,
                    sessionId: game.id,
                    sessionDate: game.played_at,
                }))
        })
        setStandings(calculateStandings(rows, configResult.data?.points_by_rank as Record<string, number> ?? DEFAULT_POINTS))
        if (sevenTwoResult.error) {
            setError(sevenTwoResult.error.message);
            return
        }
        const sevenTwoRows: PublicStandingInput[] = games.flatMap((game) => (game.session_players as unknown as Array<{
            member_id: string;
            final_rank: number | null;
            member: { name: string } | null
        }>).filter((player) => player.member).map((player) => ({
            memberId: player.member_id,
            memberName: player.member!.name,
            sessionId: game.id,
            sessionDate: game.played_at,
            finalRank: player.final_rank,
            rebuySequences: eventResult.data?.filter((event) => event.session_id === game.id && event.member_id === player.member_id).map((event) => event.sequence_number) ?? [],
        })))
        const annualRanks = new Map(calculateStandings(sevenTwoRows.map((row) => ({
            memberId: row.memberId,
            memberName: row.memberName,
            finalRank: row.finalRank,
            firstRebuySequence: row.rebuySequences.length ? Math.min(...row.rebuySequences) : null,
            sessionId: row.sessionId,
            sessionDate: row.sessionDate,
        })), {}).flatMap((standing) => standing.sessions.map((result) => [`${result.sessionId}:${standing.memberId}`, result.rank])))
        const memberNames = new Map(sevenTwoRows.map((row) => [`${row.sessionId}:${row.memberId}`, row.memberName]))
        setSevenTwoStandings(calculateSevenTwoStandings((sevenTwoResult.data ?? []).filter((event) => annualRanks.has(`${event.session_id}:${event.member_id}`)).flatMap((event) => {
            const memberName = memberNames.get(`${event.session_id}:${event.member_id}`)
            return memberName ? [{memberId: event.member_id, memberName}] : []
        })))
    }, [selectedSeasonId])

    useEffect(() => {
        if (tab === 'standings') void loadStandings()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, selectedSeasonId])

    useEffect(() => {
        if (tab !== 'standings') return
        const channel = client.channel(`standings-${selectedSeasonId}`)
            .on('postgres_changes', {event: '*', schema: 'public', table: 'session_players'}, () => {
                void loadStandings()
            })
            .on('postgres_changes', {event: '*', schema: 'public', table: 'sessions'}, () => {
                void loadStandings()
            })
            .subscribe()
        return () => {
            void client.removeChannel(channel)
        }
    }, [tab, selectedSeasonId, loadStandings])

    async function runAction(action: () => PromiseLike<{ error: { message: string } | null }>, refresh = false) {
        setBusy(true);
        setError('')
        const result = await action()
        setBusy(false)
        if (result.error) {
            setError(result.error.message);
            return false
        }
        if (refresh) await loadBase()
        return true
    }

    async function createSeason() {
        const year = Number(newYear)
        if (!Number.isInteger(year) || year < 2000 || year > 2198) {
            setError('Saisissez une année entre 2000 et 2198.');
            return
        }
        setBusy(true);
        setError('')
        const {data, error: createError} = await client.rpc('create_season', {p_start_year: year})
        setBusy(false)
        if (createError) {
            setError(createError.message);
            return
        }
        await loadBase();
        setSelectedSeasonId(String(data));
        setCreatingSeason(false);
        setTab('game')
    }

    function startNewSeason() {
        const newest = Math.max(...seasons.map((item) => item.start_year), new Date().getFullYear())
        setNewYear(String(newest + 1))
        setCreatingSeason(true)
    }


    async function createSession(form: { playedAt: string; memberIds: string[] }) {
        setBusy(true);
        setError('')
        const {data, error: createError} = await client.rpc('create_session', {
            p_season_id: Number(selectedSeasonId),
            p_played_at: form.playedAt,
            p_member_ids: form.memberIds
        })
        setBusy(false)
        if (createError) {
            setError(createError.message);
            return
        }
        await loadSessions(selectedSeasonId, data as string)
    }

    async function recordEvent(memberId: string, eventType: Event['event_type']) {
        const result = await runAction(() => client.rpc('record_session_event', {
            p_session_id: selectedSessionId,
            p_member_id: memberId,
            p_event_type: eventType
        }))
        if (result) await loadGame()
    }

    async function addMember() {
        const name = newMember.trim()
        if (!name) return
        const success = await runAction(() => client.from('members').insert({name}), true)
        if (success) setNewMember('')
    }

    async function saveConfig(next: Config) {
        if (!selectedSeasonId) return
        const success = await runAction(() => client.from('season_configurations').update({
            buy_in: next.buy_in,
            chips: next.chips,
            payout_table: next.payout_table,
            points_by_rank: next.points_by_rank
        }).eq('season_id', selectedSeasonId))
        if (success) setConfiguration(next)
    }

    async function closeSeason() {
        if (!confirm(`Clôturer la saison ${seasonLabel(seasons.find((item) => item.id === selectedSeasonId)?.start_year ?? 0)} ? Cette action rendra résultats et configuration non modifiables.`)) return
        const success = await runAction(() => client.rpc('close_season', {p_season_id: Number(selectedSeasonId)}), true)
        if (success) await loadBase()
    }

    async function inviteReader() {
        if (!inviteEmail.trim()) return
        setBusy(true);
        setError('')
        const {
            data,
            error: inviteError
        } = await client.functions.invoke('invite-reader', {body: {email: inviteEmail.trim()}})
        setBusy(false)
        if (inviteError || data?.error) {
            setError(inviteError?.message ?? data.error);
            return
        }
        setInviteEmail('')
    }

    async function createPublicLink() {
        if (!selectedSeasonId) return
        setBusy(true);
        setError('')
        const {
            data,
            error: linkError
        } = await client.rpc('create_public_standings_link', {p_season_id: Number(selectedSeasonId)})
        setBusy(false)
        if (linkError || !data) {
            setError(linkError?.message ?? 'Impossible de créer le lien public.');
            return
        }
        setPublicLink(`${window.location.origin}/classement/${data}`)
    }

    async function revokePublicLink() {
        const token = publicLink.split('/').pop()
        if (!token) return
        const success = await runAction(() => client.rpc('revoke_public_standings_link', {p_token: token}))
        if (success) setPublicLink('')
    }

    async function copyPublicLink() {
        await navigator.clipboard.writeText(publicLink)
    }

    if (!profileLoaded) return <main className="loading-screen">Vérification de votre accès…</main>
    if (!role) return <main className="access-denied"><span className="brand-mark">♠</span><h1>Accès non autorisé</h1>
        <p>Votre compte n’a pas reçu d’invitation au championnat.</p>
        <button className="secondary-button" onClick={() => void client.auth.signOut()}>Se déconnecter</button>
    </main>
    const season = seasons.find((item) => item.id === selectedSeasonId)
    const currentSession = sessions.find((item) => item.id === selectedSessionId)

    return (
        <main className="app-shell">
            <header className="topbar"><a className="brand compact" href="#home"><span className="brand-mark">♠</span>
                <div><small>CHAMPIONNAT DE POKER</small><strong>VSOP <em>TRACKER</em></strong></div>
            </a>
                <div className="topbar-actions"><span
                    className="role-pill">{role === 'organizer' ? 'ORGANISATEUR' : 'LECTEUR'}</span>
                    <button className="icon-button" aria-label="Se déconnecter"
                            onClick={() => void client.auth.signOut()}>↗
                    </button>
                </div>
            </header>
            {Boolean(seasons.length) &&
                <section className="season-bar"><label htmlFor="season-select">SAISON</label><select id="season-select"
                                                                                                     value={selectedSeasonId}
                                                                                                     onChange={(event) => {
                                                                                                         setSelectedSeasonId(event.target.value);
                                                                                                         setTab('game')
                                                                                                     }}>{seasons.map((item) =>
                    <option key={item.id}
                            value={item.id}>{seasonLabel(item.start_year)}{item.status === 'closed' ? ' · ARCHIVÉE' : ''}</option>)}</select>{canEdit &&
                    <span className="live-badge">● SAISON OUVERTE</span>}{role === 'organizer' &&
                    <button className="new-season-button"
                            onClick={() => creatingSeason ? setCreatingSeason(false) : startNewSeason()}>{creatingSeason ? 'Fermer' : '＋ Saison'}</button>}
                </section>}
            {error && <div role="alert" className="app-error">{error}
                <button aria-label="Fermer" onClick={() => setError('')}>×</button>
            </div>}
            {role === 'organizer' && !seasons.length &&
                <section className="empty-season"><p className="eyebrow">NOUVEAU CHAMPIONNAT</p><h1>Première saison</h1>
                    <p>Créez saison scolaire pour préparer première journée.</p>
                    <div className="inline-form"><label>Année de début<input inputMode="numeric" value={newYear}
                                                                             onChange={(event) => setNewYear(event.target.value)}/></label>
                        <button className="primary-button" disabled={busy}
                                onClick={() => void createSeason()}>Créer {newYear}/{Number(newYear) + 1} →
                        </button>
                    </div>
                </section>}
            {creatingSeason && <section className="new-season-form"><p className="eyebrow">NOUVELLE SAISON SCOLAIRE</p>
                <div className="inline-form"><label>Année de début<input inputMode="numeric" value={newYear}
                                                                         onChange={(event) => setNewYear(event.target.value)}/></label>
                    <button className="primary-button" disabled={busy}
                            onClick={() => void createSeason()}>Créer {newYear}/{Number(newYear) + 1} →
                    </button>
                </div>
            </section>}
            {season && <>
                {role === 'organizer' && season.status === 'open' && <div className="tabbar"
                                                                          role="tablist">{(['game', 'standings', 'members', 'settings'] as const).map((item) =>
                    <button key={item} role="tab" aria-selected={tab === item}
                            onClick={() => setTab(item)}>{item === 'game' ? 'Journée' : item === 'standings' ? 'Classement' : item === 'members' ? 'Membres' : 'Réglages'}</button>)}</div>}
                {(role === 'reader' || season.status === 'closed') && <div className="tabbar" role="tablist">
                    <button role="tab" aria-selected={tab === 'game'} onClick={() => setTab('game')}>Journées</button>
                    <button role="tab" aria-selected={tab === 'standings'} onClick={() => {
                        setTab('standings');
                        void loadStandings()
                    }}>Classement
                    </button>
                </div>}
                {tab === 'game' && <GameView season={season} sessions={sessions} selectedSessionId={selectedSessionId}
                                             onSelectSession={setSelectedSessionId} players={players} events={events}
                                             activeCount={activeCount} totalPot={totalPot} payouts={payouts}
                                             canEdit={Boolean(canEdit)} busy={busy} members={members}
                                             onCreateSession={createSession} onRecord={recordEvent}
                                             onCloseSeason={closeSeason}/>}
                {tab === 'standings' && <>
                    <section className="content-panel">
                        <div className="section-title"><p
                            className="eyebrow">SAISON {seasonLabel(season.start_year)}</p><h1>Classement général</h1>
                           </div>
                        {role === 'organizer' && <div className="public-link-tools">
                            <button className="secondary-button" disabled={busy}
                                    onClick={() => void createPublicLink()}>Générer un lien invité
                            </button>
                            {publicLink &&
                                <div className="public-link-row"><input aria-label="Lien public du classement" readOnly
                                                                        value={publicLink}/>
                                    <button className="secondary-button" onClick={() => void copyPublicLink()}>Copier
                                    </button>
                                    <button className="danger-button" onClick={() => void revokePublicLink()}>Révoquer
                                    </button>
                                </div>}</div>}
                        <div className="standings-list">{standings.length ? standings.map((row, index) => <article
                                className="standing-row" key={row.memberId}><b
                                className="standing-place">{String(index + 1).padStart(2, '0')}</b>
                                <div className="standing-info">
                                    <strong>{row.name}</strong><small>{row.sessions.map((item) => `${new Date(`${item.sessionDate}T12:00:00`).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'numeric'
                                })} · ${item.rank}e${item.rebought ? ' (R)' : ''}`).join('  /  ')}</small></div>
                                <strong className="standing-points">{row.points}<small> pts</small></strong></article>) :
                            <p className="empty-copy">Le classement apparaîtra après première journée
                                terminée.</p>}</div>
                    </section>
                    <section className="content-panel">
                        <div className="section-title"><h2>Victoires avec
                            7/2</h2></div>
                        <div
                            className="standings-list">{sevenTwoStandings.length ? sevenTwoStandings.map((row, index) =>
                                <article className="standing-row" key={row.memberId}><b
                                    className="standing-place">{String(index + 1).padStart(2, '0')}</b>
                                    <div className="standing-info"><strong>{row.name}</strong></div>
                                    <strong className="standing-points">{row.wins}<small> mains</small></strong>
                                </article>) :
                            <p className="empty-copy">Aucune main gagnée avec 7/2 enregistrée cette saison.</p>}</div>
                    </section>
                </>}
                {tab === 'members' && <section className="content-panel">
                    <div className="section-title"><p className="eyebrow">COMMUNAUTÉ</p><h1>Les membres</h1><p>Joueurs
                        disponibles pour les prochaines journées.</p></div>
                    {role === 'organizer' &&
                        <div className="inline-form"><input aria-label="Nom du membre" placeholder="Nom du membre"
                                                            value={newMember}
                                                            onChange={(event) => setNewMember(event.target.value)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter') void addMember()
                                                            }}/>
                            <button className="primary-button" onClick={() => void addMember()} disabled={busy}>Ajouter
                                +
                            </button>
                        </div>}
                    <ul className="member-list">{members.map((member) => <li key={member.id}><span
                        className="avatar">{member.name.slice(0, 1).toUpperCase()}</span>{member.name}</li>)}</ul>
                    {role === 'organizer' &&
                        <div className="invite-box"><p className="eyebrow">ACCÈS LECTEUR</p><p>Inviter compte à
                            consulter saisons et résultats en lecture seule.</p>
                            <div className="inline-form"><input type="email" aria-label="E-mail du lecteur"
                                                                placeholder="nom@exemple.fr" value={inviteEmail}
                                                                onChange={(event) => setInviteEmail(event.target.value)}/>
                                <button className="secondary-button" onClick={() => void inviteReader()}
                                        disabled={busy}>Inviter
                                </button>
                            </div>
                        </div>}</section>}
                {tab === 'settings' && role === 'organizer' && configuration &&
                    <SettingsView configuration={configuration} busy={busy} onSave={saveConfig}
                                  onCloseSeason={closeSeason}/>}
                {currentSession && tab === 'game' &&
                    <p className="sync-caption">{busy ? 'Enregistrement…' : 'État synchronisé'} · {players.length} participants</p>}
            </>}
            <nav className="mobile-nav"
                 aria-label="Navigation principale">{(['game', 'standings', 'members', 'settings'] as const).filter((item) => role === 'organizer' && season?.status === 'open' ? true : item === 'game' || item === 'standings').map((item) =>
                <button key={item} className={tab === item ? 'active' : ''} onClick={() => {
                    setTab(item);
                    if (item === 'standings') void loadStandings()
                }}>
                    <span>{item === 'game' ? '♠' : item === 'standings' ? '▤' : item === 'members' ? '♙' : '⚙'}</span>{item === 'game' ? 'Jouer' : item === 'standings' ? 'Classement' : item === 'members' ? 'Membres' : 'Réglages'}
                </button>)}</nav>
        </main>
    )
}
