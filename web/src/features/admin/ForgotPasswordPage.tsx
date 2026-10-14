import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/admin/reset-password`;
      await requestPasswordReset(email, redirectTo);
      setSent(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1>Réinitialiser le mot de passe</h1>
      {sent ? (
        <div className="card" role="status">
          <p>Si cette adresse correspond à un compte, un lien de réinitialisation a été envoyé.</p>
          <Link to="/admin/login">Retour à la connexion</Link>
        </div>
      ) : (
        <form className="card" onSubmit={submit}>
          <p className="muted">Saisis l’adresse email du compte admin.</p>
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {error && <p role="alert" style={{ color: "#ffbfb5" }}>{error}</p>}
          <button className="btn btn--block" disabled={busy} style={{ marginTop: 16 }}>
            {busy ? "Envoi…" : "Envoyer le lien"}
          </button>
          <p style={{ marginBottom: 0 }}>
            <Link to="/admin/login">Retour à la connexion</Link>
          </p>
        </form>
      )}
    </div>
  );
}
