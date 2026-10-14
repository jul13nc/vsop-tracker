import {seasonLabel} from '../lib/domain'

export type StandingsViewData = {
    season: { start_year: number }
    standings: Array<{
        memberId: string
        name: string
        points: number
        sessions: Array<{ sessionDate: string; rank: number; rebought: boolean }>
    }>
    sevenTwoStandings: Array<{ memberId: string; name: string; wins: number }>
    sessionResults: Array<{
        playedAt: string
        players: Array<{ name: string; rank: number; rebought: boolean }>
    }>
}

export function StandingsView({data, actions}: {
    data: StandingsViewData
    actions?: React.ReactNode
}) {
    return <>
        <section className="content-panel">
            <div className="section-title"><p className="eyebrow">SAISON {seasonLabel(data.season.start_year)}</p>
                <h1>Classement général</h1></div>
            {actions}
            <div className="standings-list">{data.standings.length ? data.standings.map((row, index) => <article
                className="standing-row" key={row.memberId}><b
                className="standing-place">{String(index + 1).padStart(2, '0')}</b>
                <div className="standing-info"><strong>{row.name}</strong><small>{row.sessions.map((item) =>
                    `${new Date(`${item.sessionDate}T12:00:00`).toLocaleDateString('fr-FR', {day: 'numeric', month: 'numeric'})} · ${item.rank}e`
                ).join('  /  ')}</small></div>
                <strong className="standing-points">{row.points}<small> pts</small></strong></article>) :
                <p className="empty-copy">Le classement apparaîtra après première journée terminée.</p>}</div>
        </section>
        <section className="content-panel">
            <div className="section-title"><h2>Victoires avec 7/2</h2></div>
            <div className="standings-list">{data.sevenTwoStandings.length ? data.sevenTwoStandings.map((row, index) =>
                <article className="standing-row" key={row.memberId}><b
                    className="standing-place">{String(index + 1).padStart(2, '0')}</b>
                    <div className="standing-info"><strong>{row.name}</strong></div>
                    <strong className="standing-points">{row.wins}<small> mains</small></strong></article>) :
                <p className="empty-copy">Aucune main gagnée avec 7/2 enregistrée cette saison.</p>}</div>
        </section>
        <section className="content-panel">
            <div className="section-title"><h2>Résultats des journées</h2></div>
            <div className="public-session-list">{data.sessionResults.length ? data.sessionResults.map((session) =>
                <article className="public-session-card" key={session.playedAt}>
                    <header><strong>{new Date(`${session.playedAt}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}</strong></header>
                    <ol>{session.players.slice().sort((a, b) => a.rank - b.rank).map((player) =>
                        <li key={player.rank}><span>{player.rank}e</span>
                            <strong>{player.name}{player.rebought ? ' (R)' : ''}</strong></li>)}</ol>
                </article>) : <p className="empty-copy">Aucune journée terminée pour cette saison.</p>}</div>
        </section>
    </>
}
