import { useEffect, useState } from 'react'
import { publicConfig } from './lib/config'
import { supabase } from './lib/supabase'
import { Login } from './components/Login'
import { MissingConfig } from './components/MissingConfig'
import { Dashboard } from './components/Dashboard'
import './App.css'

export default function App() {
  const [session, setSession] = useState<Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getSession']>>['data']['session']>(null)
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])
  if (!publicConfig) return <MissingConfig />
  if (!authReady) return <main className="loading-screen">Connexion à la table…</main>
  if (!session) return <Login />
  return <Dashboard session={session} />
}
