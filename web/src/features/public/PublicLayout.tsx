import { NavLink, Outlet, useParams } from "react-router-dom";
import { getSeason } from "../../api/seasons";
import { getActiveGameday } from "../../api/gamedays";
import { useAsync } from "../../hooks/useAsync";

export default function PublicLayout() {
  const { seasonId } = useParams();
  const { data: season } = useAsync(() => getSeason(seasonId!), [seasonId]);
  const { data: active } = useAsync(
    () => getActiveGameday(seasonId!),
    [seasonId],
  );

  return (
    <div className="app">
      <h1>VSOP · {season?.label ?? seasonId}</h1>
      <nav className="nav">
        <NavLink end to={`/c/${seasonId}`}>
          Classement
        </NavLink>
        <NavLink to={`/c/${seasonId}/seven-two`}>Classement 7/2</NavLink>
        <NavLink to={`/c/${seasonId}/results`}>Journées</NavLink>
        {active && (
          <NavLink to={`/c/${seasonId}/clock/${active.id}`}>
            🕐 Horloge live
          </NavLink>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
