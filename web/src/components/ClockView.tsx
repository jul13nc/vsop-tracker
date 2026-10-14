import { useEffect, useRef } from "react";
import { formatBlinds, formatClock, type ClockState } from "../domain/clock";
import type { BlindLevel } from "../types/domain";

interface Props {
  state: ClockState;
  playersRemaining: number;
  startingPlayers?: number;
  averageStack: number;
  isBubble: boolean;
  payout?: { rank: number; amount: number }[];
  upcomingLevels?: BlindLevel[];
  flash: boolean;
  playBeep: boolean;
  children?: React.ReactNode;
}

/** Plays a short beep using the Web Audio API. */
function beep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  } catch {
    /* audio not available */
  }
}

export default function ClockView({
  state,
  playersRemaining,
  startingPlayers,
  averageStack,
  isBubble,
  payout,
  upcomingLevels,
  flash,
  playBeep,
  children,
}: Props) {
  const beeped = useRef(false);
  useEffect(() => {
    if (flash && playBeep && !beeped.current) {
      beep();
      beeped.current = true;
    }
    if (!flash) beeped.current = false;
  }, [flash, playBeep]);

  return (
    <div className={`clock${flash ? " flash" : ""}${payout ? " clock--public" : ""}`}>
      {payout && (
        <aside className="clock__side clock__side--payout">
          <h2>Payout</h2>
          {payout.length ? (
            <ol>
              {payout.map(({ rank, amount }) => (
                <li key={rank}>
                  <span>{rank}<sup>{rank === 1 ? "er" : "e"}</sup></span>
                  <strong>{amount.toLocaleString("fr-FR")} €</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Non défini</p>
          )}
        </aside>
      )}

      <section className="clock__main">
        {isBubble ? (
          <div className="clock__bubble" role="status">
            C&apos;EST LA BULLE !
          </div>
        ) : (
          <div className="clock__level">Niveau {state.level?.level ?? "—"}</div>
        )}
        <div className="clock__time">{formatClock(state.secondsRemaining)}</div>
        <div className="clock__blinds">{formatBlinds(state.level)}</div>
        {!upcomingLevels && state.nextLevel && (
          <div className="clock__next">
            Suivant : {formatBlinds(state.nextLevel)}
          </div>
        )}
        <div className="clock__stats">
          <div>
            Joueurs
            <b>
              {startingPlayers === undefined
                ? playersRemaining
                : `${playersRemaining}/${startingPlayers}`}
            </b>
          </div>
          <div>
            Stack moyen<b>{averageStack.toLocaleString("fr-FR")}</b>
          </div>
        </div>
        {children}
      </section>

      {upcomingLevels && (
        <aside className="clock__side clock__side--levels">
          <h2>Blindes suivantes</h2>
          {upcomingLevels.length ? (
            <ol>
              {upcomingLevels.map((level) => (
                <li key={level.level}>
                  <span>N{level.level}</span>
                  <strong>{formatBlinds(level)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Dernier niveau</p>
          )}
        </aside>
      )}
    </div>
  );
}
