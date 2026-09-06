import type { ChangeEvent } from "react";
import { useStore } from "../context";
import { Icon } from "./Icon";
import { isValidAppStoreV2, migrateV1ToV2 } from "../persistence/migrate";
import {
  countDoneInStoreV2,
  isValidStore,
  mergeStoresV2,
  saveBackupV2,
  summarizeMergeV2,
  v2ProgressToV1Store,
} from "../store";

export function MergeImport({ onBackupChange }: { onBackupChange: () => void }) {
  const { dispatch, v2Store, dispatchV2 } = useStore();

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

      // A current export carries the whole v2 shape; an older one carries
      // only the five legacy fields. Both merge -- the v1 file is lifted to
      // v2 first so a single merge path handles both (Phase 8).
      const incoming = isValidAppStoreV2(parsed)
        ? parsed
        : isValidStore(parsed)
          ? migrateV1ToV2(parsed)
          : null;

      if (!incoming) {
        alert('That doesn\'t look like a DSA Tracker backup — it has no "problems" or "progress" data. Nothing was changed.');
        return;
      }

      // The diff is computed from the exact store that will be applied, so
      // the dialog can't promise something different from what lands.
      const merged = mergeStoresV2(v2Store, incoming);
      const summary = summarizeMergeV2(v2Store, merged);
      const nothingNew =
        !summary.newlySolved &&
        !summary.newlyStarred &&
        !summary.notesCombined &&
        !summary.mistakesAdded &&
        !summary.attemptsAdded &&
        !summary.revisionsRecorded;
      if (nothingNew) {
        alert("That file adds nothing new — everything in it is already tracked here.");
        return;
      }

      const ok = confirm(
        "Merge this backup into your progress?\n\n" +
          `Newly solved:      ${summary.newlySolved}\n` +
          `Newly starred:     ${summary.newlyStarred}\n` +
          `Notes combined:    ${summary.notesCombined}\n` +
          `Mistakes added:    ${summary.mistakesAdded}\n` +
          `Revisions added:   ${summary.revisionsRecorded}\n` +
          `Sessions added:    ${summary.attemptsAdded}\n\n` +
          `Solved after merge: ${countDoneInStoreV2(merged)} (currently ${countDoneInStoreV2(v2Store)})\n\n` +
          "Nothing already solved is un-solved. You can still Undo import afterwards."
      );
      if (!ok) return;

      // Back up the complete pre-merge store first -- merge is the last place
      // data can vanish, so Undo has to be able to restore everything.
      saveBackupV2(v2Store);
      onBackupChange();
      dispatchV2({ type: "REPLACE_STORE", store: merged });
      dispatch({ type: "IMPORT", store: v2ProgressToV1Store(merged) });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <details className="group/advanced mt-4">
      <summary
        className="disclosure inline-flex items-center gap-1.5 rounded-full border border-border bg-surface
          py-1.5 px-3 text-micro font-semibold text-muted hover:text-accent hover:border-accent-line"
      >
        <Icon name="merge" className="size-3.5" />
        Advanced — merge a backup
        <Icon name="chevronDown" className="size-3 transition-transform group-open/advanced:rotate-180" />
      </summary>
      <div className="card mx-auto mt-3 max-w-panel p-4 text-left">
        <p className="m-0 mb-3 text-caption leading-relaxed text-muted">
          <strong className="text-fg">Merge</strong> combines another device's file with what's already here instead
          of replacing it. A problem stays solved if it's solved in either copy, the earliest completion date wins,
          and differing notes are kept side by side. Revision history, mistakes and past sessions are unioned too.
          Nothing already solved is ever un-solved.
        </p>
        {/* <label> wrapping a hidden <input type="file"> -- the input must
            stay a descendant for the picker to open. */}
        <label className="btn btn-sm">
          <Icon name="merge" className="size-3.5" />
          Choose a file to merge…
          <input type="file" accept="application/json" hidden onChange={handleMerge} />
        </label>
      </div>
    </details>
  );
}
