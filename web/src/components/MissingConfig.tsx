export function MissingConfig() {
  return (
    <main className="config-screen">
      <section className="config-card">
        <div className="brand-mark">♠</div>
        <p className="eyebrow">CONFIGURATION REQUISE</p>
        <h1>Connectez votre table</h1>
        <p>Ajoutez les paramètres publics de votre projet Supabase pour démarrer l’application.</p>
        <ol>
          <li>Copiez <code>web/.env.example</code> vers <code>web/.env</code>.</li>
          <li>Renseignez l’URL et la clé publique depuis les paramètres Supabase.</li>
          <li>Redémarrez le serveur Vite.</li>
        </ol>
        <small>Clé serveur secrète ne doit jamais être placée dans application web.</small>
      </section>
    </main>
  )
}
