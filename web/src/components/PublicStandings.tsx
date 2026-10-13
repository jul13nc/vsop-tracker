import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { seasonLabel } from '../lib/domain'

type PublicResult = { name: string; points: number; sessions: Array<{ session_date: string; rank: number; points: number; rebought: boolean }> }
type PublicPayload = { season: { start_year: number; status: 'open'|'closed' }; standings: PublicResult[] }

export function PublicStandings({ token }: { token: string }) {
  const [data, setData] = useState<PublicPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    let active = true
    if (!supabase) { setLoading(false); setInvalid(true); return }
    void supabase.rpc('read_public_standings', { p_token: token }).then(({ data: payload, error }) => {
      if (!active) return
      setLoading(false)
      if (error || !payload) { setInvalid(true); return }
      setData(payload as PublicPayload)
    })
    return () => { active = false }
  }, [token])

  if (loading) return <main className="public-standings-state">Chargement du classement…</main>
  if (invalid || !data) return <main className="public-standings-state"><div className="public-standings-card"><span className="brand-mark">♠</span><p className="eyebrow">LIEN INDISPONIBLE</p><h1>Classement inaccessible</h1><p>Ce lien est invalide ou a été révoqué. Demandez un nouveau lien à l’organisateur.</p></div></main>

  return <main className="app-shell public-standings">
    <header className="topbar"><a className="brand compact" href="#classement"><span className="brand-mark">♠</span><div><small>CHAMPIONNAT DE POKER</small><strong>VSOP <em>TRACKER</em></strong></div></a><span className="role-pill">CONSULTATION PUBLIQUE</span></header>
    <section className="content-panel">
      <div className="section-title"><p className="eyebrow">SAISON {seasonLabel(data.season.start_year)}</p><h1>Classement général</h1><p>Résultats cumulés du championnat · Lecture seule</p></div>
      <div className="standings-list">{data.standings.length ? data.standings.map((row,index)=><article className="standing-row" key={row.name}><b className="standing-place">{String(index+1).padStart(2,'0')}</b><div className="standing-info"><strong>{row.name}</strong><small>{row.sessions.map((item)=>`${new Date(`${item.session_date}T12:00:00`).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} · ${item.rank}e${item.rebought?' (recave)':''}`).join('  /  ')}</small></div><strong className="standing-points">{row.points}<small> pts</small></strong></article>) : <p className="empty-copy">Aucun résultat disponible pour cette saison.</p>}</div>
    </section>
    <p className="public-standings-note">Lien de consultation en lecture seule.</p>
  </main>
}
