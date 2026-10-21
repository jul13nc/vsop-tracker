// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { usePolling } from "./usePolling";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("suspends hidden-tab polling, refreshes on return and cleans up", async () => {
  vi.useFakeTimers();
  const root = createRoot(document.createElement("div"));
  const reload = vi.fn();
  const visibility = vi.spyOn(document, "visibilityState", "get");
  function Harness() { usePolling(reload, 2000); return null; }
  try {
    visibility.mockReturnValue("visible");
    await act(async () => root.render(createElement(Harness)));
    vi.advanceTimersByTime(2000);
    expect(reload).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(20000);
    expect(reload).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reload).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
    vi.advanceTimersByTime(2000);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reload).toHaveBeenCalledTimes(2);
  } finally {
    visibility.mockRestore();
    vi.useRealTimers();
  }
});
