import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearBackupV2,
  hasBackupV2,
  loadBackupV2,
  loadStore,
  saveBackupV2,
  saveStore,
} from "./store";
import { emptyAppStoreV2 } from "./persistence/migrate";
import type { ProgressStore } from "./types";

// The localStorage-backed half of store.ts. It was previously unreachable by
// tests at all -- the suite ran under the `node` environment, where there is
// no localStorage, so none of this code could execute.

function v1(problems: ProgressStore["problems"], idsMigrated = true): ProgressStore {
  return { version: 1, problems, idsMigrated };
}

function state(done = true) {
  return { done, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("saveStore / loadStore", () => {
  it("round-trips a store through localStorage", () => {
    saveStore(v1({ a: state() }));
    expect(loadStore().problems.a.done).toBe(true);
  });

  it("returns a fresh empty store when nothing is saved", () => {
    expect(loadStore()).toEqual({ version: 1, problems: {}, idsMigrated: true });
  });

  it("degrades to an empty store on corrupt JSON rather than throwing", () => {
    localStorage.setItem("dsa-tracker-progress", "{not json");
    expect(loadStore().problems).toEqual({});
  });

  it("degrades to an empty store when the saved value has no problems map", () => {
    localStorage.setItem("dsa-tracker-progress", JSON.stringify({ version: 1 }));
    expect(loadStore().problems).toEqual({});
  });

  it("migrates ids on load and writes the migrated store back", () => {
    // p1 is a real key in the frozen idMap.json bridge.
    localStorage.setItem("dsa-tracker-progress", JSON.stringify({ version: 1, problems: { p1: state() } }));
    const loaded = loadStore();
    expect(loaded.idsMigrated).toBe(true);
    expect(loaded.problems.p1).toBeUndefined(); // remapped to its stable id
    expect(Object.keys(loaded.problems)).toHaveLength(1);
    // and the migration was persisted, so it doesn't re-run every boot
    expect(JSON.parse(localStorage.getItem("dsa-tracker-progress")!).idsMigrated).toBe(true);
  });

  it("warns once, rather than failing silently, when the browser blocks writes", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    saveStore(v1({ a: state() }));
    saveStore(v1({ b: state() }));
    // Private-mode Safari throws on every write; nagging on each one would be
    // unusable, so the warning is one-shot.
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});

describe("the one-shot undo backup", () => {
  it("reports no backup on a clean slate", () => {
    expect(hasBackupV2()).toBe(false);
    expect(loadBackupV2()).toBeNull();
  });

  it("round-trips the complete v2 store", () => {
    const v2 = { ...emptyAppStoreV2(), progress: { a: { ...emptyAppStoreV2().progress } } } as never;
    saveBackupV2(emptyAppStoreV2());
    expect(hasBackupV2()).toBe(true);
    expect(loadBackupV2()).toEqual(emptyAppStoreV2());
    void v2;
  });

  it("clears cleanly", () => {
    saveBackupV2(emptyAppStoreV2());
    clearBackupV2();
    expect(hasBackupV2()).toBe(false);
    expect(loadBackupV2()).toBeNull();
  });

  it("returns null for corrupt backup JSON instead of throwing", () => {
    localStorage.setItem("dsa-tracker-progress-backup-v2", "{not json");
    expect(loadBackupV2()).toBeNull();
  });

  it("returns null when the stored backup isn't a valid v2 store", () => {
    localStorage.setItem("dsa-tracker-progress-backup-v2", JSON.stringify({ nope: true }));
    expect(loadBackupV2()).toBeNull();
  });

  it("never touches the legacy v1 keys", () => {
    localStorage.setItem("dsa-tracker-progress", "legacy");
    localStorage.setItem("dsa-tracker-progress-backup", "legacy-undo");
    saveBackupV2(emptyAppStoreV2());
    clearBackupV2();
    expect(localStorage.getItem("dsa-tracker-progress")).toBe("legacy");
    expect(localStorage.getItem("dsa-tracker-progress-backup")).toBe("legacy-undo");
  });
});
