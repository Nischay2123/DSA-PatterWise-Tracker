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

beforeEach(() => {
  idbStore.clear();
  vi.stubGlobal("localStorage", fakeLocalStorage());
  vi.clearAllMocks();
});

describe("shouldMigrate", () => {
  it("is true when nothing exists yet, or the existing value isn't schema v2", async () => {
    const { shouldMigrate } = await import("./db");
    expect(shouldMigrate(undefined)).toBe(true);
    expect(shouldMigrate({ schemaVersion: 1 } as unknown as AppStoreV2)).toBe(true);
    expect(shouldMigrate({ schemaVersion: 2 } as AppStoreV2)).toBe(false);
  });
});

describe("loadAppStore", () => {
  it("seeds an empty v2 store when no legacy data exists", async () => {
    const { loadAppStore } = await import("./db");
    const v2 = await loadAppStore();
    expect(v2.schemaVersion).toBe(2);
    expect(v2.progress).toEqual({});
    expect(idbStore.get("dsa-tracker-v2")).toEqual(v2);
  });

  it("double-migration is a no-op: a second boot returns the existing v2 store untouched", async () => {
    const { loadAppStore } = await import("./db");
    const { migrateV1ToV2 } = await import("./migrate");
    localStorage.setItem("dsa-tracker-progress", JSON.stringify({ version: 1, idsMigrated: true, problems: { a: { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null } } }));

    const first = await loadAppStore();
    expect(migrateV1ToV2).toHaveBeenCalledTimes(1);

    const second = await loadAppStore();
    expect(second).toEqual(first);
    expect(migrateV1ToV2).toHaveBeenCalledTimes(1); // not called again
  });

  it("migration failure leaves IDB untouched", async () => {
    const { loadAppStore, MigrationError } = await import("./db");
    const { migrateV1ToV2 } = await import("./migrate");
    localStorage.setItem("dsa-tracker-progress", JSON.stringify({ version: 1, problems: { a: { done: true } } }));
    vi.mocked(migrateV1ToV2).mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await expect(loadAppStore()).rejects.toBeInstanceOf(MigrationError);
    expect(idbStore.has("dsa-tracker-v2")).toBe(false);
  });

  it("preserves both legacy localStorage keys and copies them into IDB as backups, without deleting them", async () => {
    const { loadAppStore } = await import("./db");
    const rawStore = JSON.stringify({ version: 1, idsMigrated: true, problems: { a: { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null } } });
    const rawBackup = JSON.stringify({ version: 1, idsMigrated: true, problems: {} });
    localStorage.setItem("dsa-tracker-progress", rawStore);
    localStorage.setItem("dsa-tracker-progress-backup", rawBackup);

    await loadAppStore();

    expect(idbStore.get("legacy-backup-v1")).toBe(rawStore);
    expect(idbStore.get("legacy-backup-v1-undo")).toBe(rawBackup);
    // Neither original key was touched -- they remain the rollback path.
    expect(localStorage.getItem("dsa-tracker-progress")).toBe(rawStore);
    expect(localStorage.getItem("dsa-tracker-progress-backup")).toBe(rawBackup);
  });

  it("corrupt legacy JSON degrades to an empty v2 store rather than throwing", async () => {
    const { loadAppStore } = await import("./db");
    localStorage.setItem("dsa-tracker-progress", "{not valid json");

    const v2 = await loadAppStore();
    expect(v2.schemaVersion).toBe(2);
    expect(v2.progress).toEqual({});
  });
});
