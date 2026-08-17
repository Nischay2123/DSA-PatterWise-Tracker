import type { ChangeEvent } from "react";
import { useStore } from "../context";
import { countDoneInStore, isValidStore, mergeStores, saveBackup, summarizeMerge } from "../store";

export function MergeImport({ onBackupChange }: { onBackupChange: () => void }) {
  const { store, dispatch } = useStore();

  const handleMerge = (e: ChangeEvent<HTMLInputElement>) => {
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
      const merged = mergeStores(store, parsed);
      const { newlySolved, newlyRevised, notesCombined } = summarizeMerge(store, merged);
      if (!newlySolved && !newlyRevised && !notesCombined) {
        alert("That file adds nothing new — everything in it is already tracked here.");
        return;
      }
      const ok = confirm(
        "Merge this backup into your progress?\n\n" +
          `Newly solved:   ${newlySolved}\n` +
          `Newly starred:  ${newlyRevised}\n` +
          `Notes combined: ${notesCombined}\n\n` +
          `Solved after merge: ${countDoneInStore(merged)} (currently ${countDoneInStore(store)})\n\n` +
          "Nothing already solved is un-solved. You can still Undo import afterwards."
      );
      if (!ok) return;
      saveBackup(store);
      onBackupChange();
      dispatch({ type: "IMPORT", store: merged });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <details className="mt-3.5">
      <summary className="inline-block text-muted cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        Advanced
      </summary>
      <div className="max-w-[460px] mx-auto mt-2.5 p-3 border border-border rounded-lg text-left">
        <p className="m-0 mb-2.5 leading-relaxed">
          <strong>Merge a backup</strong> combines another device's file with what's already here instead of
          replacing it. A problem stays solved if it's solved in either copy, the earliest completion date wins, and
          differing notes are kept side by side. Nothing already solved is ever un-solved.
        </p>
        <label className="text-[0.75rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer hover:bg-row-hover">
          Choose a file to merge…
          <input type="file" accept="application/json" hidden onChange={handleMerge} />
        </label>
      </div>
    </details>
  );
}
