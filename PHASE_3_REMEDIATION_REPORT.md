# Phase 3 Remediation Report — Export/Backup data-loss fix

Scope: exactly the confirmed bug from `PHASE_3_POST_IMPLEMENTATION_AUDIT.md` — Export and the internal undo-backup serializing the lossy v1 projection instead of the complete v2 store. No Phase 5 work, no revision-engine changes, no completion-gate changes, no Phase 8 merge redesign.

Branch: `feat/revision-system`. `main` untouched. Phase 4 (`d19d71b`) not modified or reverted.

---

## Root cause

`ImportExport.tsx`'s `handleExport` and both callers of the undo-backup (`ImportExport.tsx`, `MergeImport.tsx`) all read `store` from `useStore()` — the v1-shaped `ProgressStore` projection that exists solely so the pre-Phase-2 UI code didn't need rewriting. `ProblemState` (the v1 per-question shape) has exactly five fields: `done, revise, notes, completedAt, revisedAt`. Every field Phase 3 introduced — `approach`, `pseudocode`, `code`, the six structured note fields, `mistakes`, `completionGateVersion` — has no representation there, so none of it could ever reach a `JSON.stringify(store)` call, no matter how much of it existed.

---

## Exact data-loss scenario before the fix

1. User completes a question through `CompletionPanel`, writing real pseudocode.
2. User adds a structured note and a mistake via the "details" panel.
3. User clicks **Export** — "Use Export regularly as a backup" per the app's own footer text.
4. The downloaded file contains `done: true`, the empty legacy `notes` string, and dates — nothing else. Pseudocode, code, approach, all six structured notes, and the mistake are silently absent.
5. If the user later clears their browser or switches devices and re-imports that file, none of step 1-2's real work comes back. No error, no warning — the file looked like a normal backup.

The same defect existed in the "Undo import" safety net (`saveBackup(store)` in both `ImportExport.tsx` and `MergeImport.tsx`), so even the one-shot pre-import backup couldn't restore v2-only fields either.

---

## Files changed

- **`src/types.ts`** — added one `V2Action` variant, `REPLACE_STORE`, mirroring the existing v1 `IMPORT` action's "wholesale replace" shape.
- **`src/store.ts`**:
  - `v2Reducer` gained `case "REPLACE_STORE": return action.store;`.
  - New `toExportableV2(v2): AppStoreV2` — returns the full store with `settings.apiKey` blanked (never written to a file that leaves the browser, per the plan's hard rule, enforced now even though nothing populates a real key yet).
  - New `countDoneInStoreV2(v2): number` — v2-native equivalent of the existing `countDoneInStore`, used for the same "Now: X solved / File: Y solved" confirm-dialog messaging.
  - Replaced `saveBackup`/`loadBackup`/`hasBackup`/`clearBackup` (which read/wrote the v1-shaped `dsa-tracker-progress-backup` localStorage key) with `saveBackupV2`/`loadBackupV2`/`hasBackupV2`/`clearBackupV2`, operating on the full `AppStoreV2` at a **new** key, `dsa-tracker-progress-backup-v2`. The old key is left alone — deliberately not repurposed, since it's the same key `persistence/db.ts` reads once during v1→v2 migration; a new key avoids any ambiguity with that logic even though migration has already completed for any real installation.
- **`src/components/ImportExport.tsx`**:
  - `handleExport` now exports `toExportableV2(v2Store)` instead of `store`.
  - `handleImport` now detects the file's shape first (`isValidAppStoreV2` for a current-app export, `isValidStore` for an older v1-only export — the two are structurally mutually exclusive, `.progress` vs. `.problems`) and branches: a v2 file dispatches `REPLACE_STORE` (full fidelity) plus the existing `IMPORT` (so the v1-projected UI stays in sync); a v1 file goes through the **unchanged** `migrateIdsIfNeeded` + `IMPORT` path.
  - `handleUndoImport` now uses `loadBackupV2`/`clearBackupV2` and dispatches both `REPLACE_STORE` and `IMPORT`.
- **`src/components/MergeImport.tsx`** — `saveBackup(store)` → `saveBackupV2(v2Store)` before a merge. The merge computation itself (`mergeStores`) is untouched — still v1-only, exactly as the audit required not touching Phase 8's territory. Only the backup taken *before* merging is now complete.
- **`src/App.tsx`** — `hasBackup()` → `hasBackupV2()` for the `backupExists` indicator.
- **`src/store.test.ts`** — 10 new tests (see below).

---

## New export schema/behavior

An exported file is now the complete `AppStoreV2` object — `schemaVersion`, `progress` (every field per question), `revision`, `attempts`, `settings` (with `apiKey` always blanked), and `orphanedProgress`. Nothing new was added to the schema itself; this is the same type that's lived in `types.ts` since Phase 2, now actually reaching the file.

## Compatibility behavior for v1 imports

Verified unchanged and still correct: an older, pre-Phase-3 export (`{version, problems, idsMigrated}`) is detected via `isValidStore` and imported through the exact same `migrateIdsIfNeeded` + `IMPORT` path that existed before this fix — no behavior change for that path at all.

## Backup/undo behavior

`saveBackupV2` captures the complete v2 store immediately before an import or merge overwrites it; `loadBackupV2` validates it with `isValidAppStoreV2` before offering it back; "Undo import" restores the full v2 store (not just the five legacy fields) and correctly clears the backup afterward.

---

## Tests

`src/store.test.ts` grew from 62 to 72 (+10). Combined with the untouched revision-engine and persistence suites, the full run went from 160 to **170**:

- `toExportableV2` (3 tests): strips the API key while preserving everything else; preserves approach/pseudocode/code/structured notes/mistakes/dates/star/gate-version together; preserves `revisionStats` and `orphanedProgress` even though nothing writes to them yet.
- `countDoneInStoreV2` (2 tests).
- `v2Reducer` `REPLACE_STORE` (1 test): wholesale replace.
- v1/v2 shape detection (2 tests): a v1 `ProgressStore` is never mistaken for v2 and vice versa — this is the exact logic `handleImport` relies on to route correctly.
- **The critical one**: "REPLACE_STORE followed by the matching v1 sync (`patchV2FromV1`) never disturbs any v2-only field" (2 tests) — this reproduces, at the unit level, exactly what `ImportExport.tsx` does for a v2 import (`dispatchV2(REPLACE_STORE)` then `dispatch(IMPORT, v2ProgressToV1Store(...))`, which is what actually fires in a running app once the existing `[store]`-driven sync effect runs) and asserts the result is byte-identical to the imported object. Verified by hand that this round-trip is mathematically a no-op for every field before writing the test, then confirmed it live (below).

---

## Live verification (real JSON inspected, not just tests)

All performed with a freshly wiped IndexedDB + localStorage, using real DOM interaction and the actual file input — not mocked function calls:

1. **Built a rich scenario**: completed a question with real pseudocode through `CompletionPanel`, starred it, added a structured note (Key Insight) and code through the persistent "details" editors, and logged a mistake through the real add-mistake form.
2. **Captured the real Export output** by intercepting `URL.createObjectURL` to read the actual `Blob` the app generates (not a re-implementation) — confirmed `schemaVersion: 2`, all five top-level namespaces present, `settings.apiKey: ""`, and the question's entry containing `pseudocode`, `code`, `notes.keyInsight`, the mistake with its full timestamp, `completed`, `starred`/`starredAt`, `firstCompletedAt`/`lastCompletedAt`, and `completionGateVersion: 1` — every field the bug previously dropped.
3. **Wiped IndexedDB and localStorage completely**, reloaded to a fresh `0/467` install, then imported that exact captured file through the real `<input type="file">` element. The app correctly showed `1/467` and the imported question's IDB entry was **byte-for-byte identical** to the exported file's entry — verified by direct string comparison, not just visual inspection.
4. **Backward compatibility**: imported a hand-built pre-Phase-3 v1-shaped export (`{version, problems, idsMigrated}`) on a clean install — correctly recognized, migrated, and reflected in both the header count and the question's checkbox.
5. **Undo**: imported a second file on top of existing progress (with `window.confirm` temporarily mocked to `true` for this check — see note below), confirmed `saveBackupV2` captured the *pre*-import state under the new key, then clicked "Undo import" and confirmed the store was restored to exactly that pre-import snapshot and the backup key was cleared afterward.
6. **Regression sweep**: search still force-opens matching accordions and restores prior state on clear; the completion gate still opens `CompletionPanel` for a never-completed question and stays instant for everything else; no console errors at any point across the whole session.

**A note on `window.confirm`**: this browser-automation environment auto-suppresses native `confirm()` dialogs, always returning `false` to the page ("native JavaScript dialogs are disabled in this browser" — logged automatically). This is a tooling constraint, not applicable to real users, who click a real button. To verify the confirm-gated backup/undo code paths at all, `window.confirm` was temporarily monkey-patched to return `true` for those specific checks, then restored immediately after — this tests "what happens when a user clicks OK," which is what matters, rather than the tool's forced-cancel behavior.

**Two test-fixture mistakes surfaced and corrected during this verification, not app bugs**: an early manual test used the guessed id `arrays__two-pointers__two-sum` (the real one is `arrays__hashing__two-sum`) and later `arrays__hashing__3-sum` (the real one is `arrays__two-pointers__3-sum`). Both produced a real-looking but misleading "0/467 stays 0" result purely because a nonexistent id can never appear in `ALL_PROBLEMS`-based counts, even though it's stored correctly. Verified against the real `data/questions.json` before concluding these were test-data errors, not defects, and re-ran with correct ids to confirm.

---

## Remaining limitations

- **One pre-existing behavior, now more visible, not fixed here.** `patchV2FromV1` has always only added/updated ids present in the incoming v1 view — it never removes ids missing from it (this was true before this remediation too, and was previously analyzed and accepted for the *merge* path, where "absent means leave alone" is correct). For a plain v1 **Import** (as opposed to Merge), the v1 view genuinely is wholesale-replaced, but any id from a *previous* store that isn't in the new file lingers in `v2Store.progress` indefinitely — invisible in the UI (since the v1 projection no longer includes it) but still present, and now **visible in a subsequent v2 export**, since export is no longer filtered through the lossy v1 view. This was discovered live during verification (via a test-fixture mistake that happened to exercise exactly this path) and is a genuine, if minor, correctness gap — but fixing it means changing `patchV2FromV1`'s core semantics, which is explicitly out of scope for this remediation ("do not redesign the persistence architecture"). Flagged for a future, deliberate decision rather than fixed as a side effect here.
- **Merge still doesn't merge v2-only fields**, exactly as the audit found and exactly as intended — Phase 8's job, untouched.
- **The pre-existing v1-shaped undo-backup key (`dsa-tracker-progress-backup`) is now permanently orphaned.** Anyone with an in-flight "Undo" opportunity from immediately before this update ships loses that one specific safety net (not their primary data — only the temporary one-shot undo copy). Judged acceptable for a personal tool; noted explicitly rather than silently.
- File-input simulation remains unreliable in this specific browser-automation tool for some scenarios (worked here via `Object.defineProperty` on the input's `files` property after the documented `dt.files` assignment failed) — a tooling characteristic, not a code concern, consistent with prior reports.

---

## Full test / typecheck / build results

**Baseline before this remediation:** 160/160 tests passing, clean typecheck, clean build (recorded before any file was touched).

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
 ✓ src/revision/dates.test.ts (12 tests)
 ✓ src/revision/scoring.test.ts (12 tests)
 ✓ src/revision/stateMachine.test.ts (16 tests)
 ✓ src/revision/scheduler.test.ts (14 tests)
 ✓ src/revision/selection.test.ts (14 tests)
 ✓ src/persistence/migrate.test.ts (19 tests)
 ✓ src/persistence/db.test.ts (11 tests)
 ✓ src/store.test.ts (72 tests)
 Test Files  8 passed (8)
      Tests  170 passed (170)

$ npm run build
✓ 53 modules transformed
✓ built in ~450ms
```

No existing test regressed. The revision engine (Phase 4) was not touched — its 68 tests are unchanged and still pass.

---

## Verdict

PHASE_3_REMEDIATION_COMPLETE
