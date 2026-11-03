import { isValidAppStoreV2, renameMovedIds } from "../persistence/migrate";
import { mergeStoresV2, toExportableV2 } from "../store";
import type { AppStoreV2 } from "../types";
import { SyncError } from "./gist";

// One sync round, decided without any I/O: merge the gist's copy into this
// device's, then say whether this device needs the result and whether the
// gist does. Uses the same union merge as "Merge a backup", so a stale device
// can never un-solve or drop anything another one recorded.

/** JSON with object keys sorted, so equal content always compares equal. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v
  );
}

// Settings stay per device (theme, provider, API key): the merge never takes
// another device's, so they're left out of "did anything change", or two
// devices with different themes would re-upload on every round.
const content = (s: AppStoreV2) => canonical({ ...toExportableV2(s), settings: null });

export interface SyncPlan {
  merged: AppStoreV2;
  /** This device is missing something the gist has. */
  applyLocal: boolean;
  /** The gist is missing something this device has. */
  push: boolean;
  /** What to write to the gist: the merged store, minus the API key. */
  upload: string;
}

export function planSync(local: AppStoreV2, remoteText: string | null): SyncPlan {
  let remote: AppStoreV2 | null = null;
  if (remoteText !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(remoteText);
    } catch {
      throw new SyncError("bad-file");
    }
    // Overwriting a file we can't read could destroy another device's data.
    if (!isValidAppStoreV2(parsed)) throw new SyncError("bad-file");
    remote = renameMovedIds(parsed);
  }

  const merged = remote ? mergeStoresV2(local, remote) : local;
  // The merge also tidies (trims notes, fills absent dates with null), so a
  // store merged with nothing new still differs byte-for-byte from the raw
  // one. Compare against the store merged with itself: only real news counts.
  const applyLocal = !!remote && content(merged) !== content(mergeStoresV2(local, local));
  const push = !remote || content(merged) !== content(remote);
  return { merged, applyLocal, push, upload: JSON.stringify(toExportableV2(merged)) };
}
