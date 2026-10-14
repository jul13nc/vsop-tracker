import {useEffect, useState} from 'react'
import {supabase} from '../lib/supabase'
import {StandingsView, type StandingsViewData} from './StandingsView'

type PublicPayload = {
    season: StandingsViewData['season'] & { status: 'open' | 'closed' }
    standings: Array<{
        name: string
        points: number
        sessions: Array<{ session_date: string; rank: number; points: number; rebought: boolean }>
    }>
    seven_two_standings: Array<{ name: string; wins: number }>
    session_results: Array<{
        played_at: string
        players: Array<{ name: string; rank: number; rebought: boolean }>
    }>
}

export function PublicStandings({token}: { token: string }) {
    const [data, setData] = useState<StandingsViewData | null>(null)
    const [loading, setLoading] = useState(true)
    const [invalid, setInvalid] = useState(false)

    useEffect(() => {
        let active = true
        if (!supabase) {
            setLoading(false)
            setInvalid(true)
            return
        }
        void supabase.rpc('read_public_standings', {p_token: token}).then(({data: payload, error}) => {
            if (!active) return
            setLoading(false)
            if (error || !payload) {
                setInvalid(true)
                return
            }
            const result = payload as PublicPayload
            setData({
                season: result.season,
                standings: result.standings.map((row) => ({
                    memberId: row.name,
                    name: row.name,
                    points: row.points,
                    sessions: row.sessions.map((item) => ({
                        sessionDate: item.session_date,
                        rank: item.rank,
                        rebought: item.rebought,
                    })),
                })),
                sevenTwoStandings: (result.seven_two_standings ?? []).map((row) => ({
                    memberId: row.name,
                    name: row.name,
                    wins: row.wins,
                })),
                sessionResults: (result.session_results ?? []).map((item) => ({
                    playedAt: item.played_at,
                    players: item.players,
                })),
            })
        })
        return () => {
            active = false
        }
    }, [token])

    if (loading) return <main className="public-standings-state">Chargement du classement…</main>
    if (invalid || !data) return <main className="public-standings-state">
        <div className="public-standings-card"><span className="brand-mark">♠</span><p className="eyebrow">LIEN INDISPONIBLE</p>
            <h1>Classement inaccessible</h1><p>Ce lien est invalide ou a été révoqué. Demandez un nouveau lien à l’organisateur.</p></div>
    </main>

    return <main className="app-shell public-standings">
        <header className="topbar"><a className="brand compact" href="#classement"><span className="brand-mark">♠</span>
            <div><small>CHAMPIONNAT DE POKER</small><strong>VSOP <em>TRACKER</em></strong></div>
        </a><span className="role-pill">CONSULTATION PUBLIQUE</span></header>
        <StandingsView data={data}/>
        <p className="public-standings-note">Lien de consultation en lecture seule.</p>
    </main>
}
