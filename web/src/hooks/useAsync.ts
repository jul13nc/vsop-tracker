import { useCallback, useEffect, useRef, useState } from "react";

/** Serialize refreshes, preserve visible data, and ignore obsolete responses. */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: Error | null; reload: () => void; update: (data: T) => void } {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const [state, setState] = useState<{
    key: typeof run;
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ key: run, data: null, loading: true, error: null });
  const refresh = useRef<() => void>(() => undefined);
  const replace = useRef<(data: T) => void>(() => undefined);
  const reload = useCallback(() => refresh.current(), []);
  const update = useCallback((data: T) => replace.current(data), []);

  useEffect(() => {
    let disposed = false;
    let running = false;
    let queued = false;
    let revision = 0;
    setState({ key: run, data: null, loading: true, error: null });

    async function execute() {
      if (disposed) return;
      if (running) {
        // A mutation may have happened during the request: one trailing fetch
        // is needed, but a burst of realtime notifications needs no more.
        queued = true;
        return;
      }
      running = true;
      const requestRevision = revision;
      try {
        const data = await run();
        if (!disposed && requestRevision === revision) {
          setState({ key: run, data, loading: false, error: null });
        }
      } catch (error) {
        if (!disposed && requestRevision === revision) {
          setState((previous) => ({
            ...previous,
            loading: false,
            error: error instanceof Error ? error : new Error(
              typeof error === "object" && error !== null && "message" in error
                ? String(error.message)
                : String(error),
            ),
          }));
        }
      } finally {
        running = false;
        if (queued && !disposed) {
          queued = false;
          void execute();
        }
      }
    }

    refresh.current = () => { void execute(); };
    // Realtime payloads supersede any REST response already in flight.
    replace.current = (data) => {
      revision += 1;
      setState({ key: run, data, loading: false, error: null });
    };
    refresh.current();
    return () => {
      disposed = true;
      refresh.current = () => undefined;
      replace.current = () => undefined;
    };
  }, [run]);

  // Hide the previous entity immediately, even before effect cleanup runs.
  return state.key === run
    ? { data: state.data, loading: state.loading, error: state.error, reload, update }
    : { data: null, loading: true, error: null, reload, update };
}
