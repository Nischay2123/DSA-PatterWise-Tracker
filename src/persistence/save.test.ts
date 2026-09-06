import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAppStoreV2 } from "./migrate";

const set = vi.fn<(key: string, value: unknown) => Promise<void>>(async () => {});
vi.mock("idb-keyval", () => ({
  get: vi.fn(async () => undefined),
  set: (key: string, value: unknown) => set(key, value),
}));

const { saveAppStore } = await import("./db");

// The debounced write path. Coalescing matters: a session blurs a field on
// every keystroke pause, and each one would otherwise be its own IDB write.

beforeEach(() => {
  vi.useFakeTimers();
  set.mockClear();
});

afterEach(() => vi.useRealTimers());

describe("saveAppStore", () => {
  it("does not write immediately", () => {
    saveAppStore(emptyAppStoreV2());
    expect(set).not.toHaveBeenCalled();
  });

  it("writes once the debounce elapses", () => {
    saveAppStore(emptyAppStoreV2());
    vi.advanceTimersByTime(400);
    expect(set).toHaveBeenCalledOnce();
  });

  it("coalesces a burst of saves into a single write of the newest value", () => {
    const first = emptyAppStoreV2();
    const last = { ...emptyAppStoreV2(), progress: { marker: {} as never } };
    saveAppStore(first);
    vi.advanceTimersByTime(100);
    saveAppStore(last);
    vi.advanceTimersByTime(100);
    saveAppStore(last);
    vi.advanceTimersByTime(400);

    expect(set).toHaveBeenCalledOnce();
    expect(set.mock.calls[0][1]).toBe(last);
  });

  it("flushes a pending write when the tab is hidden, rather than losing it", () => {
    saveAppStore(emptyAppStoreV2());
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    // Flushed early -- no need to wait out the debounce.
    expect(set).toHaveBeenCalledOnce();
  });

  it("ignores a visibility change to visible", () => {
    saveAppStore(emptyAppStoreV2());
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(set).not.toHaveBeenCalled();
  });

  it("a flush with nothing pending is a no-op", () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    // `pending` is module state and useFakeTimers() drops the queued timeout
    // without clearing it, so drain it with a real flush first.
    document.dispatchEvent(new Event("visibilitychange"));
    set.mockClear();

    document.dispatchEvent(new Event("visibilitychange"));
    expect(set).not.toHaveBeenCalled();
  });
});
