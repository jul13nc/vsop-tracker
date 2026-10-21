// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAsync } from "./useAsync";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("useAsync", () => {
  let root: Root;
  let current: ReturnType<typeof useAsync<string>>;

  function Harness({ load }: { load: () => Promise<string> }) {
    current = useAsync(load, [load]);
    return null;
  }

  beforeEach(() => { root = createRoot(document.createElement("div")); });
  afterEach(async () => { await act(async () => root.unmount()); });

  async function render(load: () => Promise<string>) {
    await act(async () => root.render(createElement(Harness, { load })));
  }

  it("keeps existing data visible while reloading", async () => {
    const next = deferred<string>();
    const load = vi.fn().mockResolvedValueOnce("visible").mockReturnValueOnce(next.promise);
    await render(load);
    await act(async () => current.reload());
    expect(current.data).toBe("visible");
    expect(current.loading).toBe(false);
    await act(async () => next.resolve("fresh"));
    expect(current.data).toBe("fresh");
  });

  it("coalesces refresh bursts but fetches changes made during an in-flight read", async () => {
    const first = deferred<string>();
    const next = deferred<string>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    await render(load);
    await act(async () => { for (let i = 0; i < 20; i++) current.reload(); });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve("before mutation"));
    expect(load).toHaveBeenCalledTimes(2);
    // Slow requests still render: polling must not starve the initial display.
    expect(current.data).toBe("before mutation");
    await act(async () => next.resolve("after mutation"));
    expect(current.data).toBe("after mutation");
  });

  it("ignores responses for a previous route", async () => {
    const old = deferred<string>();
    await render(() => old.promise);
    await render(async () => "new gameday");
    await act(async () => old.resolve("old gameday"));
    expect(current.data).toBe("new gameday");
  });

  it("clears data when changing entity", async () => {
    await render(async () => "old gameday");
    const next = deferred<string>();
    await render(() => next.promise);
    expect(current.data).toBeNull();
    expect(current.loading).toBe(true);
    await act(async () => next.resolve("new gameday"));
  });

  it("does not overwrite realtime state with an older REST response", async () => {
    const request = deferred<string>();
    await render(() => request.promise);
    await act(async () => current.update("realtime"));
    await act(async () => request.resolve("stale snapshot"));
    expect(current.data).toBe("realtime");
  });

  it("keeps last data on failure and clears errors after recovery", async () => {
    const load = vi.fn().mockResolvedValueOnce("cached")
      .mockRejectedValueOnce({ message: "Network unavailable" })
      .mockResolvedValueOnce("recovered");
    await render(load);
    await act(async () => current.reload());
    expect(current.data).toBe("cached");
    expect(current.error?.message).toBe("Network unavailable");
    await act(async () => current.reload());
    expect(current.data).toBe("recovered");
    expect(current.error).toBeNull();
  });

  it("does not run a queued refresh after unmount", async () => {
    const request = deferred<string>();
    const load = vi.fn(() => request.promise);
    await render(load);
    await act(async () => current.reload());
    await act(async () => root.render(null));
    await act(async () => request.resolve("late"));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
