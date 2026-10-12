import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setMessage('Connexion impossible. Vérifiez vos identifiants ou demandez une invitation.')
  }

  return (
    <main className="login-screen">
      <div className="login-art"><span>♠</span><small>THE GAME IS YOURS</small></div>
      <section className="login-panel">
        <header className="brand"><span className="brand-mark">♠</span><div><small>CHAMPIONNAT DE POKER</small><h1>VSOP <em>TRACKER</em></h1></div></header>
        <p className="eyebrow">ACCÈS PRIVÉ</p>
        <h2>Rejoindre la table</h2>
        <p className="muted">Connectez-vous avec votre compte invité.</p>
        <form onSubmit={submit}>
          <label>Adresse e-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Mot de passe<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {message && <p role="alert" className="error-message">{message}</p>}
          <button className="primary-button" disabled={busy}>{busy ? 'Connexion…' : 'Entrer dans le championnat'} <span>→</span></button>
        </form>
        <p className="login-note">Accès réservé aux membres invités par l’organisateur.</p>
      </section>
    </main>
  )
}
