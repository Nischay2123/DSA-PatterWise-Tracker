import { set } from "idb-keyval";

export const LEGACY_BACKUP_KEY = "legacy-backup-v1";
export const LEGACY_BACKUP_UNDO_KEY = "legacy-backup-v1-undo";

// Runs before the risky v1 -> v2 mapping step, so the safety net exists even
// if migration itself throws. Never deletes the original localStorage keys --
// this is an additional copy, not a move.
export async function backupLegacy(rawLegacy: string, rawLegacyUndo: string | null): Promise<void> {
  await set(LEGACY_BACKUP_KEY, rawLegacy);
  if (rawLegacyUndo) await set(LEGACY_BACKUP_UNDO_KEY, rawLegacyUndo);
  downloadBackupFile(rawLegacy);
}

export function downloadBackupFile(rawLegacy: string): void {
  if (typeof document === "undefined") return;
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([rawLegacy], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dsa-tracker-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
