import { Link, Navigate, useParams } from "react-router-dom";
import { useGameday } from "../../hooks/useGameday";
import {
  computePayoutRanking,
  playersRemaining,
  totalRebuys,
} from "../../domain/ranking";
import { resolvePayout, totalBetEuros } from "../../domain/payout";

export default function PublicPayoutPage() {
  const { seasonId, gamedayId } = useParams();
  const { data, loading, error } = useGameday(gamedayId!, 0);

  if (loading) return <div className="app">Chargement du payout…</div>;
  if (error) return <div className="app">Erreur : {error.message}</div>;
  if (!data) return null;

  if (data.season.id !== seasonId) {
    return <Navigate to={`/pub/${data.season.id}/payout/${data.gameday.id}`} replace />;
  }
  if (data.gameday.status === "validated") {
    return <Navigate to={`/pub/${data.season.id}`} replace />;
  }

  const playerIds = data.players.map((player) => player.id);
  const remaining = playersRemaining(playerIds, data.events);
  if (remaining !== 1) {
    return <Navigate to={`/pub/${data.season.id}/clock/${data.gameday.id}`} replace />;
  }

  const rebuys = totalRebuys(playerIds, data.events);
  const totalBet = totalBetEuros(
    data.players.length,
    rebuys,
    data.season.buyin_cents,
  );
  const payoutRanking = computePayoutRanking(playerIds, data.events);
  const nameOf = (id: string) =>
    data.players.find((player) => player.id === id)?.display_name ?? id;

  let payout: { rank: number; amount: number }[] = [];
  let payoutError: string | null = null;
  try {
    payout = resolvePayout(totalBet, data.season.payout_table);
  } catch (caught) {
    payoutError = (caught as Error).message;
  }

  return (
    <main className="app">
      <h1>Payout — {data.gameday.date}</h1>
      <div className="card">
        <p>Partie terminée · {data.players.length} joueurs · {rebuys} recaves</p>
        <p>
          Total misé : <strong>{totalBet} €</strong>
        </p>
      </div>

      {payoutError && <div className="card" role="alert">{payoutError}</div>}

      <div className="card">
        <h2>Gains</h2>
        <table>
          <thead>
            <tr><th>Rang</th><th>Joueur</th><th>Gain</th></tr>
          </thead>
          <tbody>
            {payoutRanking.map((row) => {
              const amount = payout.find((item) => item.rank === row.rank)?.amount ?? 0;
              return (
                <tr key={row.playerId}>
                  <td>{row.rank}</td>
                  <td>{nameOf(row.playerId)}</td>
                  <td>{amount > 0 ? `${amount} €` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Link className="btn btn--ghost" to={`/pub/${data.season.id}`}>
        ← Classement
      </Link>
    </main>
  );
}
