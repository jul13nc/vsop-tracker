import { useEffect, useRef } from "react";
import { formatBlinds, formatClock, type ClockState } from "../domain/clock";
import {
  playLevelChangeSound,
  playLevelWarningSound,
} from "../lib/audio";
import type { BlindLevel } from "../types/domain";

interface Props {
  state: ClockState;
  playersRemaining: number;
  startingPlayers?: number;
  averageStack: number;
  isBubble: boolean;
  isInTheMoney: boolean;
  rebuySecondsRemaining: number;
  payout?: { rank: number; amount: number }[];
  upcomingLevels?: BlindLevel[];
  flash: boolean;
  playBeep: boolean;
  children?: React.ReactNode;
}

export default function ClockView({
  state,
  playersRemaining,
  startingPlayers,
  averageStack,
  isBubble,
  isInTheMoney,
  rebuySecondsRemaining,
  payout,
  upcomingLevels,
  flash,
  playBeep,
  children,
}: Props) {
  const beeped = useRef(false);
  useEffect(() => {
    if (flash && playBeep && !beeped.current) {
      playLevelChangeSound();
      beeped.current = true;
    }
    if (!flash) beeped.current = false;
  }, [flash, playBeep]);

  // One-minute warning before the blinds go up (once per level).
  const warnedLevel = useRef<number | null>(null);
  useEffect(() => {
    const level = state.level?.level ?? null;
    if (
      !playBeep ||
      flash ||
      state.secondsRemaining === 0 ||
      state.secondsRemaining > 60 ||
      warnedLevel.current === level
    ) {
      return;
    }
    warnedLevel.current = level;
    playLevelWarningSound();
  }, [state.level?.level, state.secondsRemaining, playBeep, flash]);

  return (
    <div className={`clock${flash ? " flash" : ""}${payout ? " clock--public" : ""}`}>
      {payout && (
          <aside className="clock__side clock__side--payout">
            <div>
            <img className="clock__logo" src="/Logo_VSOP.png" alt="VSOP" />
            </div>
            <div>
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
            )}</div>
          </aside>

      )}

      <section className="clock__main">
        {isBubble ? (
          <div className="clock__bubble" role="status">
            🫧 BUBBLE TIME ! 🫧
          </div>
        ) : isInTheMoney ? (
          <div className="clock__bubble" role="status">
            💵 IN THE MONEY ! 💵
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
        <div
            className={`clock__rebuy${rebuySecondsRemaining === 0 ? " clock__rebuy--closed" : ""}`}
            role="status"
        >
          {rebuySecondsRemaining > 0
              ? `Recave: ${formatClock(rebuySecondsRemaining)}`
              : "Plus de recave"}
        </div>

        {children}
      </section>

      {upcomingLevels && (
        <aside className="clock__side clock__side--levels">
          <div>
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
          </div>
        </aside>
      )}
    </div>
  );
}
