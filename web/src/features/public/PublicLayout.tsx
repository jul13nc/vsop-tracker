import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { getSeason } from "../../api/seasons";
import { getActiveGameday } from "../../api/gamedays";
import { useAsync } from "../../hooks/useAsync";

export default function PublicLayout() {
  const { seasonId } = useParams();
  const { data: season } = useAsync(() => getSeason(seasonId!), [seasonId]);
  const { data: active } = useAsync(
    () => getActiveGameday(),
    [],
  );

  return (
    <div className="app">
      <div className="public-heading">
        <Link to="/pub" className="brand-logo-link" aria-label="Toutes les saisons">
          <img className="brand-logo" src="/Logo_VSOP.png" alt="VSOP" />
        </Link>
        <div>
          <p className="eyebrow">CHAMPIONNAT</p>
          <h1>{season?.label ?? seasonId}</h1>
        </div>
      </div>
      <nav className="nav">
        <NavLink end to={`/pub/${seasonId}`}>
          Classement
        </NavLink>
        <NavLink to={`/pub/${seasonId}/seven-two`}>Classement 7/2</NavLink>
        <NavLink to={`/pub/${seasonId}/results`}>Journées</NavLink>
        {active && (
          <NavLink to="/pub/clock">
            🎫 Journée publique
          </NavLink>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
