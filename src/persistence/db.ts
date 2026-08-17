import { get, set } from "idb-keyval";
import type { AppStoreV2, ProgressStore } from "../types";
import { backupLegacy } from "./backup";
import { emptyAppStoreV2, isValidAppStoreV2, migrateV1ToV2 } from "./migrate";

const APP_STORE_KEY = "dsa-tracker-v2";
const LEGACY_STORE_KEY = "dsa-tracker-progress";
const LEGACY_BACKUP_KEY = "dsa-tracker-progress-backup";

// Durable, IndexedDB-independent proof that this browser has already been set
// up on v2 -- see IndexedDbMissingError below for why this exists.
const V2_INITIALIZED_KEY = "dsa-tracker-v2-initialized";

export class MigrationError extends Error {}

// Thrown when v2 is missing or corrupt but this browser was already
// initialized before. Deliberately distinct from MigrationError: this is not
// "migration failed", it's "refusing to silently roll progress back".
export class IndexedDbMissingError extends Error {}

function isV2Initialized(): boolean {
  return localStorage.getItem(V2_INITIALIZED_KEY) === "true";
}

function markV2Initialized(): void {
  localStorage.setItem(V2_INITIALIZED_KEY, "true");
}

// Boots the app's persisted state. On first run against a v1 (localStorage)
// install, backs up the raw legacy JSON *before* attempting the mapping, so
// the safety net exists even if migration itself throws -- in which case
// this rejects with MigrationError and writes nothing to IDB.
//
// Once a browser has been initialized on v2, the frozen legacy localStorage
// snapshot must never be treated as a live fallback again: if the v2 record
// later goes missing or fails validation (IDB cleared, evicted, corrupted),
// re-migrating from that stale snapshot would silently roll progress back to
// migration-day state while looking like a completely normal boot. This
// rejects with IndexedDbMissingError instead, so the caller shows the
// existing recovery/export screen rather than guessing.
async function loadAppStoreUncached(): Promise<AppStoreV2> {
  const existing = await get<AppStoreV2>(APP_STORE_KEY);
  if (existing && isValidAppStoreV2(existing)) {
    // Backfills the marker for browsers that migrated under a build that
    // predates this check, so the very next boot is already protected.
    markV2Initialized();
    return existing;
  }

  if (isV2Initialized()) {
    throw new IndexedDbMissingError(
      "Your saved progress database is missing or unreadable, but this browser was already set up before. " +
        "To avoid silently rolling your progress back, nothing was changed automatically."
    );
  }

  const rawLegacy = localStorage.getItem(LEGACY_STORE_KEY);
  if (!rawLegacy) {
    const fresh = emptyAppStoreV2();
    await set(APP_STORE_KEY, fresh);
    markV2Initialized();
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
  markV2Initialized();
  return v2;
}

// Concurrent callers (e.g. React StrictMode's mount -> cleanup -> re-mount)
// share one in-flight boot instead of each independently re-reading legacy
// data, re-writing the backup, and re-triggering the backup file download.
let inFlight: Promise<AppStoreV2> | null = null;

export function loadAppStore(): Promise<AppStoreV2> {
  if (!inFlight) {
    inFlight = loadAppStoreUncached().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
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
