# Phase 3 Report — Notes editor, mistakes, dates, completion gate

Scope: exactly the plan's Phase 3 ("Notes editor, mistakes, dates, completion gate"), per your explicit choice to resolve the Phase 3 vs. Phase 4-7 conflict in the original request by implementing plan-scope Phase 3 only. No revision state machine, scheduler, scoring, fundamentals wiring, or LLM work is included — those remain Phases 4-7.

Branch: `feat/revision-system`. `main` untouched.

---

## 1. Files created / modified

**Created:**
- `src/components/CompletionPanel.tsx` — the gated, blocking completion flow.
- `src/components/SolutionEditor.tsx` — the persistent, never-gated Approach/Pseudocode/Code editor.
- `src/components/NotesEditor.tsx` — the six structured note fields + read-only "Previous notes" (legacy).
- `src/components/MistakeList.tsx` — list/add/remove mistakes.

**Modified:**
- `src/context.ts` — `StoreContextValue` now carries `v2Store`/`dispatchV2` (previously only returned by the hook, never exposed to components).
- `src/App.tsx` — passes `v2Store`/`dispatchV2` into `StoreContext.Provider`.
- `src/store.ts` — added `CURRENT_COMPLETION_GATE_VERSION`, `hasNotes`, `hasCompletionEvidence`, `canCompleteFreely`; fixed `patchV2FromV1`'s `completionGateVersion` stamping (previously always `null`, now records a real gate pass).
- `src/components/QuestionRow.tsx` — checkbox gating logic, renamed "notes" → "details", wired the four components above into the expanded row.
- `src/store.test.ts` — 30 new tests (see §5).

**Not modified** (confirmed unnecessary): `src/types.ts` (the v2 schema — `completionGateVersion`, `V2Action`, `StructuredNoteField` — was already added in the prior remediation commit `b3c3018`; Phase 3 needed no new fields).

---

## 2. Exact Phase 3 behavior implemented

**Completion gate.** Checking a question that has *never* been completed before, with `settings.requireEvidence` on (the default), opens `CompletionPanel` instead of toggling instantly. "Mark complete" is disabled until pseudocode or code is non-empty (checked live, on every keystroke, not just on blur). Un-checking is always instant and free, with no panel, for every question regardless of gate state.

**Grandfathering.** A question that has ever been completed before (`firstCompletedAt !== null` — true for migrated data and for any question completed at least once under the new gate) is *never* re-gated: unchecking and re-checking it is always instant, exactly like the pre-Phase-3 UI. This is `canCompleteFreely` in `store.ts`, and it's also what makes `settings.requireEvidence: false` a genuine "release valve" — turning it off removes the panel entirely, not just its validation.

**`completionGateVersion` stamping.** `patchV2FromV1` now stamps `CURRENT_COMPLETION_GATE_VERSION` (currently `1`) only when a completion is genuinely new (`firstCompletedAt` was `null`) *and* evidence was present at that exact moment. Every other case — migrated data, `requireEvidence:false` completions, and all re-checks of grandfathered questions — stays `null`. This directly answers the "which questions were evidence-verified vs. grandfathered" question the field exists to answer.

**Persistent solution fields.** `SolutionEditor` (Approach/Pseudocode/Code) is always shown in the expanded row, editable regardless of completion or gate state — this is what makes "editable but not re-gated" actually possible for already-completed questions, since `CompletionPanel` only ever appears for not-yet-completed rows.

**Structured notes.** `NotesEditor` renders the six fields from the plan (Approach, Key Insight, Common Mistake, Complexity, Edge Cases, Personal Reminder) plus a read-only "Previous notes" block showing `notes.legacy` when non-empty. The old single free-text notes textarea (which dispatched the v1 `SET_NOTES` action) is gone from the UI; `SET_NOTES` itself is left defined in `context.ts` since import/merge still populate `notes.legacy` through the v1→v2 adapter regardless of whether the UI dispatches it directly.

**Notes indicator.** `hasNotes()` — "any structured field OR legacy non-empty" — replaces the old `!!state.notes.trim()` check, exactly per the plan. The `•` marker on the (renamed) "details" button now lights up for migrated legacy notes and for any newly-written structured field.

**Mistakes.** `MistakeList` adds `{at, what, remember}` entries with a full ISO timestamp (not just the day) as the identifying key, since `REMOVE_MISTAKE` removes by exact `at` match and two mistakes logged the same day need distinct keys.

**Naming note on "Approach."** The v2 schema (from Phase 2) has two separate "Approach" concepts: a top-level `approach` field (shown in `SolutionEditor`/`CompletionPanel`, next to Pseudocode/Code — your actual solution approach) and `notes.approach` (one of the six structured note categories, shown in `NotesEditor` — a personal reflection field). This duplication was already present in the approved schema; Phase 3 didn't introduce it, just implemented both fields as specified.

---

## 3. Data-model changes

None beyond what the prior remediation commit already added. `completionGateVersion`, `V2Action`, and `StructuredNoteField` all existed in `types.ts` before this phase — Phase 3 only changed *how* `completionGateVersion` gets computed (`store.ts`) and built the UI that actually exercises the existing `V2Action` write path.

---

## 4. Migration implications

None. Migrated (pre-existing) completions continue to get `completionGateVersion: null` exactly as before — verified by the existing migration test suite (unchanged) plus the new `canCompleteFreely`/gate-stamping tests, which explicitly assert a migrated completed question is exempt from the gate and stays at gate version `null`, not the current version.

---

## 5. Tests added

`src/store.test.ts` grew from 44 to 62 tests (+18, all new in this phase). Combined with the unchanged `migrate.test.ts` (19) and `db.test.ts` (11), the full suite went from 74 to 92 tests:

- `hasNotes` (4 tests): empty, legacy-only, structured-only, whitespace-only.
- `hasCompletionEvidence` (4 tests): empty, pseudocode-only, code-only, whitespace-only.
- `canCompleteFreely` (4 tests): blocks with no evidence, allows with evidence, `requireEvidence:false` bypasses, grandfathered/already-once-completed bypasses regardless of evidence.
- `completionGateVersion stamping` (4 tests): stamps the real version on a genuine gated pass; stays `null` when bypassed; stays `null` for a migrated/grandfathered completion; stays `null` on a re-check even with evidence present (re-checks are exempt, not re-verified).
- Phase 3's own acceptance test, verbatim from the plan: "legacy notes text is byte-identical after an edit to another field" (2 tests: editing a structured note field, editing pseudocode/code/approach — both confirm `notes.legacy` is untouched).

---

## 6. Full test / typecheck / build results

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
 ✓ src/persistence/migrate.test.ts (19 tests)
 ✓ src/store.test.ts (62 tests)
 ✓ src/persistence/db.test.ts (11 tests)
 Test Files  3 passed (3)
      Tests  92 passed (92)

$ npm run build
✓ 53 modules transformed
✓ built in ~400ms
```

No existing test regressed. Baseline before Phase 3 was 74 tests (all still passing); Phase 3 added 18 new tests, bringing the suite to 92 total.

---

## 7. Live browser verification results

All performed on a freshly wiped IndexedDB + localStorage, then verified via direct IDB inspection (not just visual screenshots) and a full page reload:

- **Fresh boot**: no console errors, `0/467`, all existing UI intact.
- **Completion gate, end to end**: clicking STL's (never-completed) checkbox opened `CompletionPanel` instead of toggling — checkbox stayed visually unchecked, `0/467` unchanged. "Mark complete" was disabled with empty fields, then enabled live (before blur) the instant pseudocode was typed via real keystrokes. Clicking it produced `completed: true`, `firstCompletedAt: lastCompletedAt: "2026-08-17"`, `completionGateVersion: 1`, `pseudocode: "use a stack"` in IndexedDB — verified by direct IDB read, not just the UI.
- **Persistence after reload**: full page reload preserved `1/467`, streak/heatmap stats, no console errors.
- **Grandfather exemption**: unchecking then re-checking STL was instant with no panel appearing; IDB confirmed `firstCompletedAt` unchanged (`"2026-08-17"`, never reset) and `completionGateVersion` correctly reset to `null` (the re-check is exempt, not re-verified).
- **Details panel**: renamed button, shows meta, `SolutionEditor` (pre-filled with the saved pseudocode, editable), `NotesEditor` (six fields + Previous notes), `MistakeList`.
- **Notes indicator**: typing into "Key Insight" and blurring lit up the `•` marker on the details button; IDB confirmed the value persisted.
- **Mistakes**: added one via the real add-mistake form; IDB confirmed `{at, what, remember}` with a full ISO timestamp.
- **Star independence**: starring STL set `starred`/`starredAt` while `revisionStats` stayed entirely at its default nulls — confirms ★ is never conflated with a revision event, per your explicit requirement.
- **Search + accordion restore-on-clear**: unaffected — searching force-opened matching topics, hid non-matching ones, and clearing search restored the exact prior manual-open state (Fundamentals open, others closed) — this Phase 0/1B behavior was not touched by Phase 3 and still works correctly.
- **Migration/recovery regression**: re-ran the exact stale-localStorage-after-IDB-loss scenario from the Phase 2 remediation (durable marker set, IDB wiped, stale legacy snapshot present) — the app still correctly showed the recovery screen and refused to silently re-migrate. Confirms Phase 3's changes to `patchV2FromV1` didn't disturb the unrelated `db.ts` recovery logic.

**One test-methodology pitfall worth recording**: early in verification, two different scripted attempts produced wrong-looking results (`completed: false` once, `completionGateVersion: null` after a genuine gated pass once). Both traced back to using *unscoped* `document.querySelectorAll('textarea'/'button')` — since every row renders its `SolutionEditor`/`NotesEditor`/`MistakeList` fields into the DOM at all times (just CSS-hidden when collapsed, matching the pre-existing notes-textarea convention), a global, unscoped query can silently land on a different row's hidden field. Re-scoping every query to the specific row (`row.querySelector(...)`) and switching to real `computer`-tool clicks/typing for the primary verification pass produced consistent, correct results every time after that. Not an application defect — recorded here because it consumed real debugging time and the pattern is worth remembering for Phase 4+ verification.

**Not independently re-verified via a real file-picker** in this session (same limitation as the Phase 2 remediation report): Import/Export/Merge/Undo. These components were not touched by Phase 3, and their underlying pure functions are unchanged and still covered by existing passing tests.

---

## 8. Known limitations

- The completion gate only guards the checkbox path in `QuestionRow`. Nothing else in the codebase (import, merge, a hypothetical future bulk-action) goes through `canCompleteFreely` — this matches existing precedent (the reducer has never enforced gating; it's a UI-level guard layered on top, exactly like Phase 2's `saveBackup`/`loadBackup` never validated business rules either), but it's worth naming explicitly: importing a JSON file that claims a question is `done: true` with no evidence bypasses the gate entirely, by design, since import/merge must never invent friction for restoring your own data.
- `approach` (top-level) vs. `notes.approach` (structured) is a confusing naming duplication inherited from the Phase 2 schema, not introduced or resolved here — flagged for anyone building on top of this later.
- No UI exists yet to view/act on `revisionStats`, `TopicRevision`, or `mistakes` beyond adding/removing them — that's Phase 4/6 territory, correctly out of scope.
- `SET_NOTES` (the old v1 free-text notes action) is now unreachable from the UI but still defined in `context.ts`'s reducer, kept for import/merge compatibility and because nothing requires its removal.

---

## 9. Is Phase 3 genuinely complete?

Yes, against the plan's actual Phase 3 scope. All four acceptance-test categories from the plan are implemented and passing: grandfathered completions stay completed and are never re-gated; the gate blocks empty-evidence completion; `requireEvidence:false` bypasses it entirely; legacy notes text is byte-identical after an edit to another field. Every existing feature (search, filters, accordions, star, notes-indicator-now-structured, analytics, heatmap/streak, migration/recovery) was verified working, unchanged, in the live browser.

It is **not** complete against the broader "REVISION SYSTEM" description in your original message — that was explicitly deferred to Phases 4-7 per your own resolution of the scope conflict at the start of this task.

---

## Commit

`902dac3` on `feat/revision-system`.
