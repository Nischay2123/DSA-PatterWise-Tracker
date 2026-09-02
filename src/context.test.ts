import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAppStoreV2 } from "./persistence/migrate";
import type { AppStoreV2 } from "./types";

// useProgressStore is the orchestration seam: async boot, the v1 reducer, the
// v1->v2 patch-and-save effect, and automatic revision scheduling. It was
// completely untested -- and it's the one place a bug silently loses data.

const loadAppStore = vi.fn<() => Promise<AppStoreV2>>();
const saveAppStore = vi.fn();

vi.mock("./persistence/db", () => ({
  loadAppStore: (...args: []) => loadAppStore(...args),
  saveAppStore: (...args: [AppStoreV2]) => saveAppStore(...args),
}));

const { useProgressStore } = await import("./context");

const COMPLETED = "advanced-strings__pattern-matching__z-function";

beforeEach(() => {
  loadAppStore.mockResolvedValue(emptyAppStoreV2());
  saveAppStore.mockClear();
});

afterEach(() => vi.clearAllMocks());

async function booted() {
  const view = renderHook(() => useProgressStore());
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  return view;
}

describe("boot", () => {
  it("starts in a loading state and never flashes empty data", async () => {
    let release!: (v: AppStoreV2) => void;
    loadAppStore.mockReturnValue(new Promise<AppStoreV2>((r) => (release = r)));
    const { result } = renderHook(() => useProgressStore());
    expect(result.current.status).toBe("loading");

    await act(async () => release(emptyAppStoreV2()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("seeds the v1 view from the loaded v2 store", async () => {
    const stored = emptyAppStoreV2();
    stored.progress[COMPLETED] = { ...emptyProgress(), completed: true, lastCompletedAt: "2026-01-01" };
    loadAppStore.mockResolvedValue(stored);

    const { result } = await booted();
    expect(result.current.store.problems[COMPLETED].done).toBe(true);
    expect(result.current.v2Store.progress[COMPLETED].completed).toBe(true);
  });

  it("surfaces a boot failure instead of silently starting empty", async () => {
    loadAppStore.mockRejectedValue(new Error("IDB is unreadable"));
    const { result } = renderHook(() => useProgressStore());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.bootError).toBe("IDB is unreadable");
    // Nothing may be written after a failed boot -- that's how you clobber
    // real data with an empty store.
    expect(saveAppStore).not.toHaveBeenCalled();
  });

  it("reports a non-Error rejection without crashing", async () => {
    loadAppStore.mockRejectedValue("just a string");
    const { result } = renderHook(() => useProgressStore());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.bootError).toBe("just a string");
  });
});

describe("v1 dispatch keeps v2 in step", () => {
  it("persists a completion through to the v2 store", async () => {
    const { result } = await booted();
    act(() => result.current.dispatch({ type: "TOGGLE_DONE", id: COMPLETED, done: true }));

    await waitFor(() => expect(result.current.v2Store.progress[COMPLETED]?.completed).toBe(true));
    expect(saveAppStore).toHaveBeenCalled();
    const saved = saveAppStore.mock.calls.at(-1)![0] as AppStoreV2;
    expect(saved.progress[COMPLETED].completed).toBe(true);
  });

  it("bumps importNonce only on IMPORT, so the tree remounts just then", async () => {
    const { result } = await booted();
    const before = result.current.importNonce;
    act(() => result.current.dispatch({ type: "TOGGLE_DONE", id: COMPLETED, done: true }));
    expect(result.current.importNonce).toBe(before);

    act(() => result.current.dispatch({ type: "IMPORT", store: { version: 1, problems: {}, idsMigrated: true } }));
    expect(result.current.importNonce).toBe(before + 1);
  });

  it("schedules a revision automatically once a topic crosses the threshold", async () => {
    // advanced-strings has 6 problems; 5 completed clears 75%.
    const stored = emptyAppStoreV2();
    for (const id of [
      "advanced-strings__pattern-matching__hashing-in-strings-theory",
      "advanced-strings__pattern-matching__rabin-karp-algorithm",
      "advanced-strings__pattern-matching__z-function",
      "advanced-strings__pattern-matching__kmp-algorithm-or-lps-array",
    ]) {
      stored.progress[id] = { ...emptyProgress(), completed: true };
    }
    loadAppStore.mockResolvedValue(stored);
    const { result } = await booted();
    expect(result.current.v2Store.revision["advanced-strings"]).toBeUndefined(); // 4/6 is under threshold

    act(() =>
      result.current.dispatch({
        type: "TOGGLE_DONE",
        id: "advanced-strings__pattern-matching__shortest-palindrome",
        done: true,
      })
    );
    await waitFor(() => expect(result.current.v2Store.revision["advanced-strings"]).toBeDefined());
    expect(result.current.v2Store.revision["advanced-strings"].nextDueAt).not.toBeNull();
  });
});

describe("dispatchV2 writes fields the v1 shape cannot carry", () => {
  it("stores pseudocode and persists it", async () => {
    const { result } = await booted();
    act(() => result.current.dispatchV2({ type: "SET_PSEUDOCODE", id: COMPLETED, pseudocode: "two pointers" }));

    expect(result.current.v2Store.progress[COMPLETED].pseudocode).toBe("two pointers");
    const saved = saveAppStore.mock.calls.at(-1)![0] as AppStoreV2;
    expect(saved.progress[COMPLETED].pseudocode).toBe("two pointers");
  });

  it("a later v1 dispatch never clobbers a v2-only field", async () => {
    const { result } = await booted();
    act(() => result.current.dispatchV2({ type: "SET_CODE", id: COMPLETED, code: "def f(): pass" }));
    act(() => result.current.dispatch({ type: "TOGGLE_DONE", id: COMPLETED, done: true }));

    await waitFor(() => expect(result.current.v2Store.progress[COMPLETED].completed).toBe(true));
    expect(result.current.v2Store.progress[COMPLETED].code).toBe("def f(): pass");
  });
});

function emptyProgress() {
  return {
    completed: false,
    starred: false,
    starredAt: null,
    firstCompletedAt: null,
    lastCompletedAt: null,
    completionGateVersion: null,
    approach: "",
    pseudocode: "",
    code: "",
    notes: { legacy: "", approach: "", keyInsight: "", commonMistake: "", complexity: "", edgeCases: "", reminder: "" },
    mistakes: [],
    revisionStats: { count: 0, lastRevisedAt: null, lastScore: null, lastConfidence: null },
  };
}
