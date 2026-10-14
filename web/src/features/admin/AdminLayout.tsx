import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function AdminLayout() {
  const { signOut } = useAuth();
  return (
    <div className="app">
      <div className="row spread">
        <h1 className="brand-lockup" style={{ margin: 0 }}>
          <Link to="/admin" style={{ textDecoration: "none" }}>
            <span className="brand-mark" aria-hidden="true">♠</span>
            <span>VSOP <small>CHAMPIONSHIP</small></span>
          </Link>
        </h1>
        <button className="btn btn--ghost" onClick={() => signOut()}>
          Déconnexion
        </button>
      </div>
      <nav className="nav">
        <NavLink to="/admin/seasons">Saisons</NavLink>
        <NavLink to="/admin/players">Membres</NavLink>
        <a href="/pub" target="_blank" rel="noreferrer">
          Vue publique ↗
        </a>
      </nav>
      <Outlet />
    </div>
  );
}
