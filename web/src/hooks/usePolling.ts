import { useEffect } from "react";

/** Keep the REST fallback without polling tabs nobody is watching. */
export function usePolling(reload: () => void, intervalMs: number) {
  useEffect(() => {
    if (intervalMs <= 0) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const timer = window.setInterval(refreshVisible, intervalMs);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [reload, intervalMs]);
}
