import { useCallback, useEffect } from "react";
import { getGameday, listGamedayPlayers } from "../api/gamedays";
import { listEvents } from "../api/events";
import { getSeason } from "../api/seasons";
import { listPlayers } from "../api/players";
import { useAsync } from "./useAsync";
import { useRealtimeGameday } from "./useRealtimeGameday";
import type {
  GameEvent,
  Gameday,
  GamedayPlayer,
  Player,
  Season,
} from "../types/domain";

export interface GamedayBundle {
  gameday: Gameday;
  season: Season;
  players: Player[];
  gamedayPlayers: GamedayPlayer[];
  events: GameEvent[];
}

async function load(gamedayId: string): Promise<GamedayBundle> {
  const gameday = await getGameday(gamedayId);
  if (!gameday) throw new Error("Journée introuvable");
  const [season, gamedayPlayers, events, allPlayers] = await Promise.all([
    getSeason(gameday.season_id),
    listGamedayPlayers(gamedayId),
    listEvents(gamedayId),
    listPlayers(),
  ]);
  if (!season) throw new Error("Saison introuvable");
  const ids = new Set(gamedayPlayers.map((gp) => gp.player_id));
  const players = allPlayers.filter((p) => ids.has(p.id));
  return { gameday, season, players, gamedayPlayers, events };
}

/** Load a gameday bundle and keep it fresh via realtime. */
export function useGameday(gamedayId: string, pollIntervalMs = 2500) {
  const state = useAsync(() => load(gamedayId), [gamedayId]);
  const { reload } = state;
  const onChange = useCallback(() => reload(), [reload]);
  useRealtimeGameday(gamedayId, onChange);

  // Realtime is the fast path. Polling is a fallback for clients where
  // websocket traffic cannot pass through a device/network proxy. The live
  // admin entry screen opts out to avoid background reloads while operating.
  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    const poll = window.setInterval(reload, pollIntervalMs);
    return () => window.clearInterval(poll);
  }, [reload, pollIntervalMs]);

  return state;
}
