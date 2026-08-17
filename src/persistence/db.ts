import { get, set } from "idb-keyval";
import type { AppStoreV2, ProgressStore } from "../types";
import { backupLegacy } from "./backup";
import { emptyAppStoreV2, migrateV1ToV2 } from "./migrate";

const APP_STORE_KEY = "dsa-tracker-v2";
const LEGACY_STORE_KEY = "dsa-tracker-progress";
const LEGACY_BACKUP_KEY = "dsa-tracker-progress-backup";

export class MigrationError extends Error {}

export function shouldMigrate(existing: AppStoreV2 | undefined): boolean {
  return !existing || existing.schemaVersion !== 2;
}

// Boots the app's persisted state. On first run against a v1 (localStorage)
// install, backs up the raw legacy JSON *before* attempting the mapping, so
// the safety net exists even if migration itself throws -- in which case
// this rejects with MigrationError and writes nothing to IDB.
export async function loadAppStore(): Promise<AppStoreV2> {
  const existing = await get<AppStoreV2>(APP_STORE_KEY);
  if (!shouldMigrate(existing)) return existing as AppStoreV2;

  const rawLegacy = localStorage.getItem(LEGACY_STORE_KEY);
  if (!rawLegacy) {
    const fresh = emptyAppStoreV2();
    await set(APP_STORE_KEY, fresh);
    return fresh;
  }

  await backupLegacy(rawLegacy, localStorage.getItem(LEGACY_BACKUP_KEY));

  let parsed: ProgressStore | null = null;
  try {
    parsed = JSON.parse(rawLegacy);
  } catch {
    parsed = null; // corrupt legacy JSON degrades to an empty store, same as the vanilla app did
  }

  let v2: AppStoreV2;
  try {
    v2 = migrateV1ToV2(parsed);
  } catch (err) {
    throw new MigrationError(err instanceof Error ? err.message : String(err));
  }

  await set(APP_STORE_KEY, v2);
  return v2;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: AppStoreV2 | null = null;

function flush(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pending) {
    const toSave = pending;
    pending = null;
    void set(APP_STORE_KEY, toSave);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function saveAppStore(store: AppStoreV2): void {
  pending = store;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}
