import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      await signOut();
      navigate("/admin/login", { replace: true });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1>Choisir un nouveau mot de passe</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="new-password">Nouveau mot de passe</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <label htmlFor="confirm-password">Confirmer le mot de passe</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        {error && <p role="alert" style={{ color: "#ffbfb5" }}>{error}</p>}
        <button className="btn btn--block" disabled={busy} style={{ marginTop: 16 }}>
          {busy ? "Mise à jour…" : "Enregistrer le mot de passe"}
        </button>
        <p style={{ marginBottom: 0 }}>
          <Link to="/admin/login">Retour à la connexion</Link>
        </p>
      </form>
    </div>
  );
}
