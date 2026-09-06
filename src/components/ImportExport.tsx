import type { ChangeEvent } from "react";
import { useStore } from "../context";
import { isValidAppStoreV2 } from "../persistence/migrate";
import { Icon } from "./Icon";
import {
  clearBackupV2,
  countDoneInStore,
  countDoneInStoreV2,
  isValidStore,
  loadBackupV2,
  migrateIdsIfNeeded,
  saveBackupV2,
  toExportableV2,
  todayISO,
  v2ProgressToV1Store,
} from "../store";


export function ImportExport({
  backupExists,
  onBackupChange,
}: {
  backupExists: boolean;
  onBackupChange: () => void;
}) {
  const { store, dispatch, v2Store, dispatchV2 } = useStore();

  const handleExport = () => {
    // The full v2 store -- approach/pseudocode/code/notes/mistakes included,
    // API key excluded (never leaves the browser in a file).
    const exportable = toExportableV2(v2Store);
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    // Date-stamped so a folder of backups is tellable apart when it matters most.
    a.download = `dsa-tracker-progress-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(reader.result as string);
      } catch {
        alert("That file isn't valid JSON, so nothing was changed.");
        return;
      }

      // A full v2 export (current app) carries approach/pseudocode/code/notes/
      // mistakes; an older v1 export (pre-Phase-3) carries only the five
      // legacy fields. Both remain importable -- checked in that order since
      // the shapes never overlap (`.progress` vs. `.problems`).
      if (isValidAppStoreV2(parsed)) {
        const currentDone = countDoneInStoreV2(v2Store);
        const incomingDone = countDoneInStoreV2(parsed);
        if (currentDone > 0) {
          const ok = confirm(
            "Replace your current progress?\n\n" +
              `Now:  ${currentDone} solved\n` +
              `File: ${incomingDone} solved\n\n` +
              "This restores your full saved progress, including code, notes, and mistakes. " +
              "Your current progress will be kept as a one-time backup you can recover with Undo import."
          );
          if (!ok) return;
          saveBackupV2(v2Store);
          onBackupChange();
        }
        dispatchV2({ type: "REPLACE_STORE", store: parsed });
        dispatch({ type: "IMPORT", store: v2ProgressToV1Store(parsed) });
        return;
      }

      if (isValidStore(parsed)) {
        const currentDone = countDoneInStore(store);
        const incomingDone = countDoneInStore(parsed);
        if (currentDone > 0) {
          const ok = confirm(
            "Replace your current progress?\n\n" +
              `Now:  ${currentDone} solved\n` +
              `File: ${incomingDone} solved\n\n` +
              "Your current progress will be kept as a one-time backup you can recover with Undo import."
          );
          if (!ok) return;
          saveBackupV2(v2Store);
          onBackupChange();
        }
        const { store: migratedStore } = migrateIdsIfNeeded(parsed);
        dispatch({ type: "IMPORT", store: migratedStore });
        return;
      }

      alert('That doesn\'t look like a DSA Tracker backup — it has no "problems" or "progress" data. Nothing was changed.');
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleUndoImport = () => {
    const backup = loadBackupV2();
    if (!backup) return;
    if (!confirm(`Restore your progress from before the last import (${countDoneInStoreV2(backup)} solved)?`)) return;
    dispatchV2({ type: "REPLACE_STORE", store: backup });
    dispatch({ type: "IMPORT", store: v2ProgressToV1Store(backup) });
    clearBackupV2();
    onBackupChange();
  };

  return (
    // Vertical, icon-led entries: these moved out of the header button row
    // and into the sidebar's "Your data" group, where they read as a menu
    // rather than three competing toolbar buttons.
    <div className="flex flex-col gap-0.5">
      <button className="nav-item" onClick={handleExport} title="Download progress as JSON">
        <Icon name="download" className="size-4" />
        Export backup
      </button>
      {/* <label> wrapping a hidden <input type="file"> -- the only way to
          style a file picker; the input must stay a descendant. */}
      <label className="nav-item" title="Load progress from JSON">
        <Icon name="upload" className="size-4" />
        Import backup
        <input type="file" accept="application/json" hidden onChange={handleImport} />
      </label>
      {backupExists && (
        <button
          className="nav-item text-accent"
          onClick={handleUndoImport}
          title="Restore the progress you had before the last import"
        >
          <Icon name="undo" className="size-4" />
          Undo import
        </button>
      )}
    </div>
  );
}
