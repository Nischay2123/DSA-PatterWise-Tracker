import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreV2 } from "../types";

const idbStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
}));

vi.mock("./migrate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./migrate")>();
  return { ...actual, migrateV1ToV2: vi.fn(actual.migrateV1ToV2) };
});

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    _store: store,
  };
}

const V2_KEY = "dsa-tracker-v2";
const INITIALIZED_KEY = "dsa-tracker-v2-initialized";
const LEGACY_KEY = "dsa-tracker-progress";
const LEGACY_BACKUP_KEY = "dsa-tracker-progress-backup";

function validV2(): AppStoreV2 {
  return { schemaVersion: 2, progress: {}, revision: {}, attempts: {}, settings: {} as AppStoreV2["settings"], orphanedProgress: {} };
}

beforeEach(() => {
  idbStore.clear();
  vi.stubGlobal("localStorage", fakeLocalStorage());
  vi.clearAllMocks();
});

describe("loadAppStore -- normal boot paths", () => {
  it("seeds an empty v2 store on a genuine first-ever install, and marks it initialized", async () => {
    const { loadAppStore } = await import("./db");
    const v2 = await loadAppStore();
    expect(v2.schemaVersion).toBe(2);
    expect(v2.progress).toEqual({});
    expect(idbStore.get(V2_KEY)).toEqual(v2);
    expect(localStorage.getItem(INITIALIZED_KEY)).toBe("true");
  });

  it("double-migration is a no-op: a second boot returns the existing v2 store untouched", async () => {
    const { loadAppStore } = await import("./db");
    const { migrateV1ToV2 } = await import("./migrate");
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, idsMigrated: true, problems: { a: { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null } } }));

    const first = await loadAppStore();
    expect(migrateV1ToV2).toHaveBeenCalledTimes(1);

    const second = await loadAppStore();
    expect(second).toEqual(first);
    expect(migrateV1ToV2).toHaveBeenCalledTimes(1); // not called again
  });

  it("migration failure leaves IDB untouched and does not mark the browser as initialized", async () => {
    const { loadAppStore, MigrationError } = await import("./db");
    const { migrateV1ToV2 } = await import("./migrate");
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, problems: { a: { done: true } } }));
    vi.mocked(migrateV1ToV2).mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await expect(loadAppStore()).rejects.toBeInstanceOf(MigrationError);
    expect(idbStore.has(V2_KEY)).toBe(false);
    expect(localStorage.getItem(INITIALIZED_KEY)).toBeNull();
  });

  it("preserves both legacy localStorage keys and copies them into IDB as backups, without deleting them", async () => {
    const { loadAppStore } = await import("./db");
    const rawStore = JSON.stringify({ version: 1, idsMigrated: true, problems: { a: { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null } } });
    const rawBackup = JSON.stringify({ version: 1, idsMigrated: true, problems: {} });
    localStorage.setItem(LEGACY_KEY, rawStore);
    localStorage.setItem(LEGACY_BACKUP_KEY, rawBackup);

    await loadAppStore();

    expect(idbStore.get("legacy-backup-v1")).toBe(rawStore);
    expect(idbStore.get("legacy-backup-v1-undo")).toBe(rawBackup);
    expect(localStorage.getItem(LEGACY_KEY)).toBe(rawStore);
    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).toBe(rawBackup);
  });

  it("corrupt legacy JSON on a first-ever install degrades to an empty v2 store rather than throwing", async () => {
    const { loadAppStore } = await import("./db");
    localStorage.setItem(LEGACY_KEY, "{not valid json");

    const v2 = await loadAppStore();
    expect(v2.schemaVersion).toBe(2);
    expect(v2.progress).toEqual({});
  });

  it("an existing valid v2 record backfills the initialized marker for browsers migrated before this check existed", async () => {
    const { loadAppStore } = await import("./db");
    const existing = validV2();
    idbStore.set(V2_KEY, existing);
    expect(localStorage.getItem(INITIALIZED_KEY)).toBeNull(); // simulates pre-remediation state

    const v2 = await loadAppStore();
    expect(v2).toEqual(existing);
    expect(localStorage.getItem(INITIALIZED_KEY)).toBe("true");
  });
});

describe("loadAppStore -- stale-localStorage rollback protection", () => {
  it("refuses to re-migrate when v2 is missing but this browser was already initialized (IDB cleared/evicted)", async () => {
    const { loadAppStore, IndexedDbMissingError } = await import("./db");
    const { migrateV1ToV2 } = await import("./migrate");
    localStorage.setItem(INITIALIZED_KEY, "true");
    // A stale, frozen legacy snapshot from before the original migration --
    // exactly what must NOT be silently re-adopted as current progress.
    const staleRaw = JSON.stringify({ version: 1, idsMigrated: true, problems: { old: { done: true, revise: false, notes: "", completedAt: "2020-01-01", revisedAt: null } } });
    localStorage.setItem(LEGACY_KEY, staleRaw);

    await expect(loadAppStore()).rejects.toBeInstanceOf(IndexedDbMissingError);
    expect(migrateV1ToV2).not.toHaveBeenCalled();
    expect(idbStore.has(V2_KEY)).toBe(false);
    // The stale snapshot itself must be left exactly alone -- not consumed, not deleted.
    expect(localStorage.getItem(LEGACY_KEY)).toBe(staleRaw);
  });

  it("refuses the same way when the v2 record present in IDB is corrupted (wrong shape)", async () => {
    const { loadAppStore, IndexedDbMissingError } = await import("./db");
    localStorage.setItem(INITIALIZED_KEY, "true");
    idbStore.set(V2_KEY, { schemaVersion: 2 /* missing progress/revision/etc. */ });

    await expect(loadAppStore()).rejects.toBeInstanceOf(IndexedDbMissingError);
    // The corrupted record is left as-is -- not overwritten with a fresh empty store.
    expect(idbStore.get(V2_KEY)).toEqual({ schemaVersion: 2 });
  });

  it("does NOT refuse on a genuine first-ever install (no marker, v2 missing, no legacy data either)", async () => {
    const { loadAppStore } = await import("./db");
    const v2 = await loadAppStore();
    expect(v2.schemaVersion).toBe(2);
    expect(v2.progress).toEqual({});
  });

  it("an unreadable/rejecting IDB read fails loudly instead of falling back to legacy data", async () => {
    const { get } = await import("idb-keyval");
    vi.mocked(get).mockRejectedValueOnce(new Error("IDB unavailable"));
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, idsMigrated: true, problems: {} }));

    const { loadAppStore } = await import("./db");
    await expect(loadAppStore()).rejects.toThrow("IDB unavailable");
    expect(idbStore.has(V2_KEY)).toBe(false);
  });
});

describe("loadAppStore -- concurrency", () => {
  it("concurrent calls share one in-flight boot instead of double-migrating", async () => {
    const { loadAppStore } = await import("./db");
    const { migrateV1ToV2 } = await import("./migrate");
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, idsMigrated: true, problems: { a: { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null } } }));

    const [a, b] = await Promise.all([loadAppStore(), loadAppStore()]);

    expect(a).toEqual(b);
    expect(migrateV1ToV2).toHaveBeenCalledTimes(1);
    const { set } = await import("idb-keyval");
    // backupLegacy's legacy-backup-v1 write only happens once per real migration attempt.
    const backupCalls = vi.mocked(set).mock.calls.filter(([key]) => key === "legacy-backup-v1");
    expect(backupCalls).toHaveLength(1);
  });
});
