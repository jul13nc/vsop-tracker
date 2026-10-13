import {useEffect, useState} from 'react'
import {supabase} from '../lib/supabase'
import {seasonLabel} from '../lib/domain'

type PublicResult = {
    name: string;
    points: number;
    sessions: Array<{ session_date: string; rank: number; points: number; rebought: boolean }>
}
type PublicSession = {
    played_at: string;
    pot: number;
    payout_table: Record<string, Record<string, number>>;
    players: Array<{ name: string; rank: number }>
}
type PublicPayload = {
    season: { start_year: number; status: 'open' | 'closed' };
    standings: PublicResult[];
    seven_two_standings: Array<{ name: string; wins: number }>;
    session_results: PublicSession[]
}

export function PublicStandings({token}: { token: string }) {
    const [data, setData] = useState<PublicPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [invalid, setInvalid] = useState(false)

    useEffect(() => {
        let active = true
        if (!supabase) {
            setLoading(false);
            setInvalid(true);
            return
        }
        void supabase.rpc('read_public_standings', {p_token: token}).then(({data: payload, error}) => {
            if (!active) return
            setLoading(false)
            if (error || !payload) {
                setInvalid(true);
                return
            }
            const result = payload as PublicPayload
            setData({
                ...result,
                seven_two_standings: result.seven_two_standings ?? [],
                session_results: result.session_results ?? []
            })
        })
        return () => {
            active = false
        }
    }, [token])

    if (loading) return <main className="public-standings-state">Chargement du classement…</main>
    if (invalid || !data) return <main className="public-standings-state">
        <div className="public-standings-card"><span className="brand-mark">♠</span><p className="eyebrow">LIEN
            INDISPONIBLE</p><h1>Classement inaccessible</h1><p>Ce lien est invalide ou a été révoqué. Demandez un
            nouveau lien à l’organisateur.</p></div>
    </main>

    return <main className="app-shell public-standings">
        <header className="topbar"><a className="brand compact" href="#classement"><span className="brand-mark">♠</span>
            <div><small>CHAMPIONNAT DE POKER</small><strong>VSOP <em>TRACKER</em></strong></div>
        </a><span className="role-pill">CONSULTATION PUBLIQUE</span></header>
        <section className="content-panel">
            <div className="section-title"><p className="eyebrow">SAISON {seasonLabel(data.season.start_year)}</p>
                <h1>Classement général</h1></div>
            <div className="standings-list">{data.standings.length ? data.standings.map((row, index) => <article
                    className="standing-row" key={row.name}><b
                    className="standing-place">{String(index + 1).padStart(2, '0')}</b>
                    <div className="standing-info">
                        <strong>{row.name}</strong><small>{row.sessions.map((item) => `${new Date(`${item.session_date}T12:00:00`).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short'
                    })} · ${item.rank}e${item.rebought ? ' (recave)' : ''}`).join('  /  ')}</small></div>
                    <strong className="standing-points">{row.points}<small> pts</small></strong></article>) :
                <p className="empty-copy">Aucun résultat disponible pour cette saison.</p>}</div>
        </section>
        <section className="content-panel">
            <div className="section-title"><h2>Victoires avec 7/2</h2></div>
            <div
                className="standings-list">{data.seven_two_standings.length ? data.seven_two_standings.map((row, index) =>
                    <article className="standing-row" key={row.name}><b
                        className="standing-place">{String(index + 1).padStart(2, '0')}</b>
                        <div className="standing-info"><strong>{row.name}</strong></div>
                        <strong className="standing-points">{row.wins}<small> mains</small></strong></article>) :
                <p className="empty-copy">Aucune main gagnée avec 7/2 enregistrée cette saison.</p>}</div>
        </section>
        <section className="content-panel">
            <div className="section-title"><h2>Résultats des journées</h2></div>
            <div className="public-session-list">{data.session_results.length ? data.session_results.map((session) =>
                <article className="public-session-card" key={session.played_at}>
                    <header><strong>{new Date(`${session.played_at}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    })}</strong></header>
                    <div className="standing-names"> <p className="public-session-players">{session.players
                        .slice()
                        .sort((a, b) => a.rank - b.rank)
                        .map((player) => player.name)
                        .join(', ')}</p></div>
                </article>) : <p className="empty-copy">Aucune journée terminée pour cette saison.</p>}</div>
        </section>
        <p className="public-standings-note">Lien de consultation en lecture seule.</p>
    </main>
}
