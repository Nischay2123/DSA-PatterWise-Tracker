import type { ChangeEvent } from "react";
import { useStore } from "../context";
import {
  clearBackup,
  countDoneInStore,
  isValidStore,
  loadBackup,
  migrateIdsIfNeeded,
  saveBackup,
  todayISO,
} from "../store";

const BUTTON_CLASS = "text-[0.85rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer";

export function ImportExport({
  backupExists,
  onBackupChange,
}: {
  backupExists: boolean;
  onBackupChange: () => void;
}) {
  const { store, dispatch } = useStore();

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
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
      if (!isValidStore(parsed)) {
        alert('That doesn\'t look like a DSA Tracker backup — it has no "problems" data. Nothing was changed.');
        return;
      }
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
        saveBackup(store);
        onBackupChange();
      }
      const { store: migratedStore } = migrateIdsIfNeeded(parsed);
      dispatch({ type: "IMPORT", store: migratedStore });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleUndoImport = () => {
    const backup = loadBackup();
    if (!backup) return;
    if (!confirm(`Restore your progress from before the last import (${countDoneInStore(backup)} solved)?`)) return;
    dispatch({ type: "IMPORT", store: backup });
    clearBackup();
    onBackupChange();
  };

  return (
    <div className="flex gap-2">
      <button className={BUTTON_CLASS} onClick={handleExport} title="Download progress as JSON">
        Export
      </button>
      <label className={BUTTON_CLASS} title="Load progress from JSON">
        Import
        <input type="file" accept="application/json" hidden onChange={handleImport} />
      </label>
      {backupExists && (
        <button
          className={BUTTON_CLASS}
          onClick={handleUndoImport}
          title="Restore the progress you had before the last import"
        >
          Undo import
        </button>
      )}
    </div>
  );
}
