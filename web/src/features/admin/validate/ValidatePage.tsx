import { useNavigate, useParams } from "react-router-dom";
import { useGameday } from "../../../hooks/useGameday";
import {
  computeGamedayRanking,
  computePayoutRanking,
  totalRebuys,
} from "../../../domain/ranking";
import { resolvePayout, totalBetEuros } from "../../../domain/payout";
import { pointsForRank } from "../../../domain/points";
import { validateGameday } from "../../../api/standings";

export default function ValidatePage() {
  const { gamedayId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useGameday(gamedayId!, 0);

  if (loading) return <div className="app">Chargement…</div>;
  if (error) return <div className="app">Erreur : {error.message}</div>;
  if (!data) return null;

  const { gameday, season, players, events } = data;
  const ids = players.map((p) => p.id);
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.display_name ?? id;

  // Championship ranking (points) vs payout ranking (pure elimination order).
  const champRanking = computeGamedayRanking(ids, events);
  const payoutRanking = computePayoutRanking(ids, events);
  const rebuys = totalRebuys(ids, events);
  const bet = totalBetEuros(players.length, rebuys, season.buyin_cents);

  let payout: { rank: number; amount: number }[] = [];
  let payoutError: string | null = null;
  try {
    payout = resolvePayout(bet, season.payout_table);
  } catch (e) {
    payoutError = (e as Error).message;
  }
  const amountFor = (rank: number) =>
    payout.find((p) => p.rank === rank)?.amount ?? 0;

  const validated = gameday.status === "validated";

  async function validate() {
    if (!confirm("Valider la journée et mettre à jour le classement ?")) return;
    try {
      await validateGameday(
        gamedayId!,
        ids,
        events,
        season.points_scheme,
        gameday.counts_double,
      );
      reload();
      navigate(`/admin/seasons/${season.id}`);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <h2>Résultats — {gameday.date}</h2>
      <div className="card row spread">
        <div>Total misé : <b>{bet}€</b></div>
        <div>Recaves : <b>{rebuys}</b></div>
        {gameday.counts_double && <span className="badge">compte double</span>}
      </div>

      {payoutError && <div className="card" style={{ color: "#ffbfb5" }}>{payoutError}</div>}

      <div className="card">
        <h3>Gains (ordre d'élimination)</h3>
        <table>
          <thead>
            <tr>
              <th>Rang</th>
              <th>Joueur</th>
              <th>Gain</th>
            </tr>
          </thead>
          <tbody>
            {payoutRanking.map((r) => (
              <tr key={r.playerId}>
                <td>{r.rank}</td>
                <td>
                  {nameOf(r.playerId)}{" "}
                  {r.rebuys > 0 && (
                    <span className="badge badge--rebuy">R×{r.rebuys}</span>
                  )}
                </td>
                <td>{amountFor(r.rank) > 0 ? `${amountFor(r.rank)}€` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Points championnat</h3>
        <table>
          <thead>
            <tr>
              <th>Rang</th>
              <th>Joueur</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {champRanking.map((r) => (
              <tr key={r.playerId}>
                <td>{r.rank}</td>
                <td>
                  {nameOf(r.playerId)}{" "}
                  {r.rebuys > 0 && (
                    <span className="badge badge--rebuy">R×{r.rebuys}</span>
                  )}
                </td>
                <td>
                  {pointsForRank(
                    r.rank,
                    season.points_scheme,
                    gameday.counts_double,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validated ? (
        <div className="card">
          <span className="badge">Journée validée ✓</span>
        </div>
      ) : (
        <button className="btn btn--block" onClick={validate}>
          Valider & mettre à jour le classement
        </button>
      )}
    </div>
  );
}
