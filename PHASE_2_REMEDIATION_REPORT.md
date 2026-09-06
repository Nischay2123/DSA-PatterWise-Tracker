# Phase 2 Remediation Report

Implements the four required remediation items from `PHASE_2_ARCHITECTURE_REVIEW.md`'s `CHANGES_REQUIRED_BEFORE_PHASE_3` verdict, plus both lower-priority safety improvements. No Phase 3 UI, revision system, LLM evaluator, scheduling, or completion gate was built — this phase only makes the Phase 2 persistence foundation correct and safe.

Branch: `feat/revision-system`. `main` untouched.

---

## 1. What was changed, and why

### 1.1 `firstCompletedAt` / `lastCompletedAt` semantics (review §3.1)

**Problem.** `patchV2FromV1` set `firstCompletedAt = lastCompletedAt = state.completedAt` on every dispatch. Since v1's `completedAt` is a single nullable scalar (set on check, cleared on uncheck), a complete → uncheck → re-complete cycle silently destroyed the original completion date.

**Fix** (`src/store.ts`, `patchV2FromV1`): track whether this dispatch represents a genuine `false → true` transition (`justCompleted = state.done && !base.completed`), and only let that transition write dates:

```ts
firstCompletedAt: base.firstCompletedAt ?? (state.done ? state.completedAt : null),
lastCompletedAt: justCompleted ? state.completedAt : base.lastCompletedAt,
```

- `firstCompletedAt` is set once, from `null`, and never overwritten afterward — the historical fact of the first completion.
- `lastCompletedAt` only changes on a new completion; an uncheck (or any unrelated dispatch re-patching this id) leaves it as-is. The plan doesn't ask for it to be cleared on uncheck, so it isn't.
- Un-checking still works exactly as before (`completed` still tracks `state.done` directly) — nothing about "un-checking is always free" (plan §7) changed.

No alternate semantic model was invented — this is exactly the model the review specified.

### 1.2 v2-native write actions (review §3.2, §7, §8)

**Problem.** `approach`, `pseudocode`, `code`, the six structured `notes.*` fields, and `mistakes` have no v1 equivalent, so nothing in the existing reducer/adapter could ever write them.

**Fix.** Added `V2Action` (`src/types.ts`) and `v2Reducer` (`src/store.ts`), mirroring the existing `Action`/`storeReducer` naming convention:

```ts
type V2Action =
  | { type: "SET_APPROACH"; id: string; approach: string }
  | { type: "SET_PSEUDOCODE"; id: string; pseudocode: string }
  | { type: "SET_CODE"; id: string; code: string }
  | { type: "SET_STRUCTURED_NOTE"; id: string; field: StructuredNoteField; value: string }
  | { type: "ADD_MISTAKE"; id: string; mistake: { at: string; what: string; remember: string } }
  | { type: "REMOVE_MISTAKE"; id: string; at: string };
```

`v2Reducer` patches `v2.progress[id]` directly via a small `patchV2Progress` helper (spreads the existing entry, overwrites only the targeted field) — the same pattern `patchProblem` already uses for v1. `getV2Progress(v2, id)` mirrors `getState()` for the v1 side, returning a default entry for an id not yet in `progress`.

**Why fields survive legacy actions "for free," not by extra effort:** `patchV2FromV1` was already structured as `{...base, <explicit v1-derived fields>}` before this remediation — it spreads the existing entry first and only overwrites the specific fields it knows how to derive from v1 (`completed`, `starred`, `starredAt`, the two completion dates, `completionGateVersion`, `notes.legacy`). It has never touched `approach`/`pseudocode`/`code`/`mistakes`/the five other structured note fields/`revisionStats`, so once `v2Reducer` writes real values into them, no subsequent v1 dispatch can clobber them — this is verified by tests, not just asserted (§4 below).

**Wiring** (`src/context.ts`): `v2Ref` (a `useRef`) was replaced with `v2Store` (a `useState`), so a future Phase 3 component can actually re-render on v2 changes. A new `dispatchV2` callback applies `v2Reducer` and persists via `saveAppStore`, using the functional `setV2Store(prev => ...)` form so it composes safely with the existing v1-sync effect regardless of ordering. `useProgressStore()` now returns `v2Store`/`dispatchV2` alongside the existing fields — nothing consumes them yet, and `App.tsx` required zero changes (it doesn't destructure the new fields).

### 1.3 Completion-gate grandfathering (review §4, "pattern/topic-level revision gates" item; user's request §3)

**Problem.** Nothing distinguished a question completed before Phase 3's future evidence gate exists from one completed after.

**Fix.** Added `completionGateVersion: number | null` to `QuestionProgressV2` (`src/types.ts`):

- `null` = grandfathered / no gate applied. Every migrated entry gets `null` (`liftV1Entry`, `src/persistence/migrate.ts`) — migrated data predates the gate by definition.
- A future positive integer (once Phase 3 ships a real gate and its own write action) would record which gate version's evidence rule a completion satisfied.
- `patchV2FromV1` re-stamps `null` on every new completion made through the **legacy** v1 path (`completionGateVersion: justCompleted ? null : base.completionGateVersion`) — since no gate exists in this codebase yet, every completion possible today is, correctly, ungated. This also means a *future* re-completion through the old unguarded path (if it ever remains reachable after Phase 3 ships) can't retain a stale non-null gate version from an earlier, different completion event.

Chose a version-number field over a boolean, per the explicit instruction, because it supports future gate-rule evolution (a later gate version could tighten or loosen the evidence rule without losing the ability to tell which rule an old completion satisfied). Named `completionGateVersion` to match the existing `schemaVersion` naming convention.

### 1.4 Stale-localStorage silent rollback risk (review §3.3 — the most serious finding)

**Problem.** Once migrated, the legacy `localStorage["dsa-tracker-progress"]` key is frozen forever. If the v2 IndexedDB record ever went missing or failed validation (eviction, manual clearing, corruption), the old code had no way to distinguish "never migrated yet" from "was migrated, now missing" — it would silently re-migrate from the stale snapshot, rolling progress back to migration-day state with no error and no warning.

**Fix** (`src/persistence/db.ts`, `src/persistence/migrate.ts`):

1. **A durable marker independent of IndexedDB.** `localStorage["dsa-tracker-v2-initialized"] = "true"` is written on every successful path: after a fresh empty seed, after a successful migration, and — critically — after finding an *already-valid* v2 record (backfilling browsers that migrated under the pre-remediation build, so their very next boot is protected).
2. **Structural validation of what comes back from IDB.** `isValidAppStoreV2()` (`src/persistence/migrate.ts`) checks `schemaVersion === 2` and that all five namespaces (`progress`, `revision`, `attempts`, `settings`, `orphanedProgress`) are present and object-shaped. A `schemaVersion: 2` record missing/malforming those is treated as invalid, not trusted.
3. **The refusal itself.** In `loadAppStore()`, once "no usable v2 record" is established, a new check runs *before* touching legacy localStorage: if `isV2Initialized()`, this browser was already set up — throw `IndexedDbMissingError` instead of migrating. Nothing is read from `LEGACY_STORE_KEY` for this decision, nothing is written to IDB, and the existing generic error boot path (already built for `MigrationError`) shows the same recovery screen with its "Export raw progress as JSON" button, which still works because it reads directly from localStorage.

**Handling the five scenarios distinctly, as instructed:**

| Scenario | Behavior |
|---|---|
| Genuinely missing on first-ever install (no marker, no v2, no legacy v1) | Seeds an empty v2 store, marks initialized. Unchanged from before. |
| Temporarily unavailable (`get()` rejects) | The rejection propagates un-caught by any silent fallback; the app shows the error screen. Nothing is written. Not classified as `IndexedDbMissingError` specifically (see §5 residual risk below), but still fails safe. |
| Cleared (marker set, v2 missing) | `IndexedDbMissingError`. Legacy snapshot, if present, is left untouched — not consumed. |
| Corrupted (marker set, v2 present but fails `isValidAppStoreV2`) | Same `IndexedDbMissingError` path. The corrupted record itself is left as-is, not overwritten. |
| Missing after a real migration (marker set, v2 missing, stale legacy snapshot present) | The dangerous case from the review — now `IndexedDbMissingError`, verified live in the browser (see §7). |

**Verified live, not just in unit tests**: seeded a realistic stale v1 snapshot + the initialized marker, deleted the IndexedDB database, reloaded — the app showed the recovery screen and left both the stale localStorage snapshot and the empty IndexedDB completely untouched (screenshot evidence in §7).

### 1.5 Lower-priority items (both implemented, not skipped)

- **`isValidAppStoreV2()`** — implemented as part of 1.4 above; it was required to correctly distinguish "corrupted" from "missing" per item 4's own scenario list, not just a nice-to-have.
- **In-flight guard for `loadAppStore()`** — a module-level `inFlight` promise now makes concurrent callers (e.g. React StrictMode's dev-only mount → cleanup → re-mount) share one boot instead of each independently re-reading legacy data and re-triggering the backup download. Verified by a concurrency test (§4).

Neither required a larger architectural change, so both are included in full.

---

## 2. Exact data-model changes

`src/types.ts`:

```ts
export interface QuestionProgressV2 {
  // ...unchanged fields...
  completionGateVersion: number | null;  // NEW
  // ...unchanged fields...
}

export type StructuredNoteField =                                   // NEW
  | "approach" | "keyInsight" | "commonMistake"
  | "complexity" | "edgeCases" | "reminder";

export type V2Action =                                              // NEW
  | { type: "SET_APPROACH"; id: string; approach: string }
  | { type: "SET_PSEUDOCODE"; id: string; pseudocode: string }
  | { type: "SET_CODE"; id: string; code: string }
  | { type: "SET_STRUCTURED_NOTE"; id: string; field: StructuredNoteField; value: string }
  | { type: "ADD_MISTAKE"; id: string; mistake: { at: string; what: string; remember: string } }
  | { type: "REMOVE_MISTAKE"; id: string; at: string };
```

No changes to `TopicRevision`, `RevisionAttempt`, `AppSettings`, or `AppStoreV2`'s top-level shape — the review found no gaps there for Phase 3's scope specifically (the pattern-level revision gate gap is a Phase 5 concern, correctly left alone).

`src/persistence/migrate.ts`: added `isValidAppStoreV2()`; `liftV1Entry` now sets `completionGateVersion: null`.

`src/store.ts`: `patchV2FromV1` rewritten per §1.1/§1.3; added `getV2Progress`, `v2Reducer`.

`src/persistence/db.ts`: added `V2_INITIALIZED_KEY`, `isV2Initialized`/`markV2Initialized`, `IndexedDbMissingError`, the in-flight guard; `loadAppStore` rewritten per §1.4. Removed `shouldMigrate` (replaced by `isValidAppStoreV2`, which does the same job more precisely — a required refactor for item 4, not an unrelated cleanup).

`src/context.ts`: `v2Ref` (ref) → `v2Store` (state); added `dispatchV2`.

---

## 3. Migration behavior (unchanged contract, extended shape)

The v1 → v2 mapping contract from Phase 2 is unchanged: real dates preserved, `revisedAt` → `starredAt` never treated as a revision event, unmappable ids parked in `orphanedProgress`, already-stable-id stores pass through unchanged. The only addition is that every migrated entry now also carries `completionGateVersion: null` (grandfathered), and a successful migration now also writes the `dsa-tracker-v2-initialized` marker to localStorage.

---

## 4. Persistence / recovery behavior (new)

Summarized in §1.4's table. The key behavioral guarantee, stated precisely: **once `dsa-tracker-v2-initialized` is `"true"`, this browser will never again silently re-derive its progress from `localStorage["dsa-tracker-progress"]`.** That key becomes permanently inert data from that point on — useful only as a manual export/recovery source, never as an automatic fallback.

---

## 5. Tests added

Test count: **49 → 74** (25 new tests). All in the existing three files, no new test files.

`src/store.test.ts` (+19):
- `patchV2FromV1 -- completion date semantics` (6 tests): first completion, uncheck preserves both dates, re-completion updates `lastCompletedAt` without touching `firstCompletedAt`, multiple cycles, a redundant no-op re-patch, and a migrated-entry-then-legacy-dispatch integration test.
- `v2Reducer -- v2-only fields are never clobbered by legacy v1 actions` (8 tests): pseudocode/code/structured-notes/mistakes survive a subsequent v1 action (the 4 tests item 2 explicitly required), `REMOVE_MISTAKE` targeting, `revisionStats` survives a legacy action, starred/starredAt unchanged by a v2-native write.

`src/persistence/migrate.test.ts` (+7):
- `completionGateVersion grandfathering` (3): migrated completed question is `null`, migrated incomplete question is `null`, idempotency.
- `isValidAppStoreV2` (4): accepts well-formed, rejects null/array/wrong-version, rejects missing namespaces, rejects array-typed namespaces.

`src/persistence/db.test.ts` (rewritten, 6 → 11, net +5 after removing the `shouldMigrate` test it replaces):
- Existing coverage preserved: first-ever seed, double-migration no-op, migration-failure-leaves-IDB-untouched, both legacy keys preserved, corrupt-JSON-degrades-to-empty.
- New: existing valid v2 backfills the marker; refuses to re-migrate when marker is set and v2 is missing (the stale-snapshot danger case, with an explicit assertion that the stale snapshot itself is left byte-identical); refuses the same way for a corrupted-but-present v2 record; does *not* refuse on a genuine first-ever install; an `IDB.get()` rejection fails loudly instead of falling back; concurrent `loadAppStore()` calls share one in-flight boot (asserted via a single `migrateV1ToV2` call and a single `legacy-backup-v1` write).

---

## 6. Regression results

**Baseline (before any change):** 49/49 tests, clean typecheck, clean build.

**After remediation:**

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
 ✓ src/persistence/migrate.test.ts (19 tests)
 ✓ src/persistence/db.test.ts (11 tests)
 ✓ src/store.test.ts (44 tests)
 Test Files  3 passed (3)
      Tests  74 passed (74)

$ npm run build
✓ 49 modules transformed
✓ built in ~400ms
```

**Live browser verification** (fresh IndexedDB + localStorage each time):

- Fresh install boots cleanly, `dsa-tracker-v2-initialized` marker set. ✅
- Search auto-opens matching accordions, hides non-matching topics; clearing search restores the exact pre-search open/closed state (`Fundamentals` open, others closed) — the Phase-0/1B accordion behavior is unaffected. ✅
- Checkbox complete → IDB shows `firstCompletedAt = lastCompletedAt = "2026-08-17"`. ✅
- Uncheck → IDB shows `completed: false`, **both dates preserved** (`"2026-08-17"`, unchanged) — this is the exact bug from review §3.1, now fixed and observed fixed live. ✅
- Star toggle → `starred: true`, `starredAt` set, unrelated to `revisionStats`. ✅
- **The critical new scenario**: seeded a stale pre-migration v1 snapshot + the initialized marker, deleted the IndexedDB database entirely, reloaded → app showed "Couldn't load your progress" / "Your saved progress database is missing or unreadable, but this browser was already set up before..." with a working "Export raw progress as JSON" button. Confirmed via direct IDB inspection: **zero keys written** to IndexedDB, and the stale localStorage snapshot was **byte-identical** to what was seeded — nothing was consumed or overwritten. ✅

One console-error red herring encountered mid-verification: a stale browser tab (left open across multiple `context.ts` edits) reported a React "hooks order changed" warning. Opening a genuinely fresh tab to the same URL showed zero console errors — confirmed this was leftover Vite Fast-Refresh/HMR state in that one tab, not a real defect in the source (the hook call sequence in `useProgressStore`/`App` is unconditional and identical on every render). Also encountered: two browser tabs open to the same origin caused IndexedDB connections to block each other (`indexedDB.open()` hanging indefinitely) during the recovery-scenario test — closing the stale tab resolved it immediately. Neither issue reflects an application defect; both are noted here for transparency about what happened during verification, not because they indicate a code problem.

**Not independently re-verified live in this session** (regression risk assessed as low, not zero): Import/Merge/Undo/Export via the actual file-picker UI. Programmatically simulating a `<input type="file">` selection in this browser-automation environment proved unreliable (the file list didn't register through either `DataTransfer` assignment or a native-setter workaround) — a tooling limitation, not a code path that changed. Confidence this still works rests on: (a) `ImportExport.tsx`/`MergeImport.tsx` were not modified by this remediation at all; (b) the pure functions they call (`mergeStores`, `isValidStore`, `summarizeMerge`, `migrateIdsIfNeeded`) are unchanged and still covered by their existing passing tests; (c) all three ultimately call `dispatch({type: "IMPORT", store: ...})`, which was directly exercised and verified live via the checkbox/star tests above (identical downstream `wrappedDispatch` → `storeReducer` → `patchV2FromV1` → `saveAppStore` pipeline).

---

## 7. Remaining risks (known, bounded, not blocking)

- **Multi-tab last-write-wins** (review §3.6) — inherited from the original vanilla app, not addressed here; out of this remediation's scope.
- **`get()` rejections aren't wrapped in a specific error class** — they propagate as-is rather than as `IndexedDbMissingError` or `MigrationError`. The app still fails safe (shows the error screen, writes nothing), just with a less specific message in that one case. Left alone deliberately to keep this change minimal; worth revisiting if error-screen copy ever needs to be more precise per-failure-mode.
- **A narrow upgrade window**: if a browser's IndexedDB is lost in the *same session* as upgrading to this remediated build, before ever completing one successful `loadAppStore()` call, the marker backfill hasn't happened yet and the old (unsafe) fallback behavior would still occur once, for that one browser, on that one occasion. Unavoidable without a build-time migration script; assessed as very low practical likelihood.
- **Pattern-level revision gate schema** (review §4, "pattern/topic-level revision gates") — still absent, but explicitly a Phase 5 concern per the plan, not Phase 3.
- **`REVISION_CONFIG` / configurable interval question** — still open per the original review (§9, item 4's "configurable 5/7-day threshold" ambiguity); not touched here since it's a Phase 4 concern.
- **`v2Store`/`dispatchV2` are wired but unconsumed** — by design, since Phase 3 UI wasn't built. Nothing currently reads `v2Store` reactively; Phase 3 will need to thread it through a context provider (or similar) to actually display/edit the new fields.

---

## Verdict

READY_FOR_PHASE_3
