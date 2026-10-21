import { getGamedayBundle } from "../api/gamedays";
import { useAsync } from "./useAsync";
import { useRealtimeGameday } from "./useRealtimeGameday";
import { usePolling } from "./usePolling";

/** Load a gameday bundle and keep it fresh via realtime. */
export function useGameday(gamedayId: string, pollIntervalMs = 2500) {
  const state = useAsync(() => getGamedayBundle(gamedayId), [gamedayId]);
  const { reload } = state;
  useRealtimeGameday(gamedayId, reload);

  // Realtime is the fast path. Polling is a fallback for clients where
  // websocket traffic cannot pass through a device/network proxy. The live
  // admin entry screen opts out to avoid background reloads while operating.
  usePolling(reload, pollIntervalMs);

  return state;
}
