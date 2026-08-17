# Phase 2 Architecture Review

Read-only audit of the Phase 2 implementation as it exists on `feat/revision-system` at commit `cdf104f`. No files were modified to produce this report.

Files inspected: `src/types.ts`, `src/persistence/migrate.ts`, `src/persistence/db.ts`, `src/persistence/backup.ts`, `src/store.ts`, `src/context.ts`, `src/App.tsx`, `src/persistence/migrate.test.ts`, `src/persistence/db.test.ts`, `src/components/ImportExport.tsx`, `src/components/MergeImport.tsx`, plus the live IndexedDB record (inspected via the running dev server in an earlier session).

---

## 1. Current schema

### `QuestionProgressV2` (per-question state — `src/types.ts:67-92`)

```ts
interface QuestionProgressV2 {
  completed: boolean;
  starred: boolean;
  starredAt: string | null;          // v1 `revisedAt` -- a bookmark date, NOT a revision date
  firstCompletedAt: string | null;
  lastCompletedAt: string | null;
  approach: string;
  pseudocode: string;
  code: string;
  notes: {
    legacy: string; approach: string; keyInsight: string;
    commonMistake: string; complexity: string; edgeCases: string; reminder: string;
  };
  mistakes: { at: string; what: string; remember: string }[];
  revisionStats: {
    count: number;
    lastRevisedAt: string | null;    // real revisions only, never fabricated from starredAt
    lastScore: number | null;
    lastConfidence: "strong" | "partial" | "forgot" | null;
  };
}
```

| Field | Meaning |
|---|---|
| `completed` | Whether the question is checked off. Mirrors v1 `done`. |
| `starred` | The ★ bookmark — a manual "mark for revision" flag, unrelated to the scheduled-revision system. Mirrors v1 `revise`. |
| `starredAt` | When the ★ was last toggled on. Mirrors v1 `revisedAt`. **A bookmark date, not a revision event.** |
| `firstCompletedAt` | Intended as the immutable date the question was *first ever* completed. |
| `lastCompletedAt` | The most recent completion date. |
| `approach` / `pseudocode` / `code` | New, v2-only. Not populated by migration (always `""`); written by a Phase 3 editor. |
| `notes.legacy` | The single free-text note field from v1, carried over verbatim. |
| `notes.{approach,keyInsight,commonMistake,complexity,edgeCases,reminder}` | New structured note fields per plan §7. Always `""` post-migration. |
| `mistakes` | New, v2-only. Per-question list of recorded mistakes, fed into weak-area weighting later. |
| `revisionStats` | The **real** revision record for this question: how many times it's actually been revised, when, and how well. **Deliberately disconnected from `starred`/`starredAt`.** |

### `TopicRevision` (top-level revision state — `src/types.ts:94-103`)

```ts
interface TopicRevision {
  topicId: string;
  cycle: number;                 // successful passes
  nextDueAt: string | null;
  lastPassedAt: string | null;
  lastFailedAt: string | null;
  activeSessionId: string | null;
  history: { at: string; score: number; passed: boolean; attemptId: string }[];
  weakConcepts: Record<string, number>;
}
```

One record per topic. `cycle`/`nextDueAt` drive the scheduling interval; `history` is the append-only log a `deriveState()` function (not yet written — that's Phase 4) will read to compute `NOT_STARTED` / `REVISION_DUE` / `MASTERED` / etc. Nothing here is written yet — `revision: {}` is always empty in the current build.

### `AppSettings` (revision + app settings — `src/types.ts:124-131`)

```ts
interface AppSettings {
  requireEvidence: boolean;
  llmEnabled: boolean;
  theme: string;
  provider: "gemini" | "grok";
  model: string;
  apiKey: string;
}
```

Note: this does **not** include the scheduling tunables from plan §5's `REVISION_CONFIG` (`completionThreshold`, `intervalDays`, `passScore`, `masteryCycles`, etc.) — see §9 below. That config was specified as a static, code-level constants module, not user-editable settings, so its absence from `AppSettings` matches the plan as written. It is called out here only because the user's review request explicitly asked about a "configurable 5/7-day threshold" — see the open question in §9.

### `QuestionProgressV2`/progress map (top-level container — `src/types.ts:133-141`)

```ts
interface AppStoreV2 {
  schemaVersion: 2;
  progress: Record<string, QuestionProgressV2>;
  revision: Record<string, TopicRevision>;
  attempts: Record<string, RevisionAttempt>;
  settings: AppSettings;
  orphanedProgress: Record<string, QuestionProgressV2>;
}
```

### Verification: `starred`/`starredAt` vs. real revision state

**Confirmed completely separate, in both code and tests.**

- `liftV1Entry` (`migrate.ts:29-51`) sets `starredAt: v1.revisedAt ?? null` and, on the same object, hardcodes `revisionStats: { count: 0, lastRevisedAt: null, lastScore: null, lastConfidence: null }` — it never derives `lastRevisedAt` from `revisedAt`.
- `patchV2FromV1` (`store.ts:344-359`), which runs on every subsequent app state change, only ever writes `starred`/`starredAt` from the v1 view — it has no code path that touches `revisionStats` at all.
- Explicit test: `migrate.test.ts:106-110`, *"maps revisedAt to starredAt, and never seeds revisionStats.lastRevisedAt from it"* — asserts `entry.starredAt === "2026-02-01"` and `entry.revisionStats.lastRevisedAt === null` in the same case.

This is correctly implemented. The old `revisedAt` is never interpreted as an actual revision date anywhere in the current code.

---

## 2. What is correct

- The v1→v2 date-preservation rule (`firstCompletedAt`/`lastCompletedAt` populated only from a real `completedAt`, never fabricated) is implemented and tested (`migrate.test.ts:94-104`).
- `revisedAt` → `starredAt` mapping, and the refusal to seed `revisionStats.lastRevisedAt` from it, is implemented and tested (see §1).
- Unmappable ids are parked in `orphanedProgress`, never dropped (`migrate.ts:63-67`, tested at `migrate.test.ts:86-92`).
- Already-migrated stores (`idsMigrated: true`) pass through without a redundant `idMap` lookup (`migrate.ts:62`, tested at `migrate.test.ts:64-75`).
- `migrateV1ToV2` is a pure function — no localStorage/IDB access inside it — matching the plan's "Vitest, pure functions only" testing philosophy and making it trivially unit-testable.
- Migration backs up the raw legacy JSON **before** attempting the risky mapping step (`db.ts:31` runs before the `migrateV1ToV2` try/catch), so a throwing migration still leaves a safety net.
- A throwing migration does not write to IDB (`db.ts:40-48`, tested at `db.test.ts:65-75`).
- Both legacy localStorage keys (`dsa-tracker-progress`, `dsa-tracker-progress-backup`) are read but never deleted or overwritten by the v2 code path (tested at `db.test.ts:77-91`).
- The existing UI (accordions, filters, search, heatmap, streak, Analytics, Import/Export/Merge/Undo) was verified live in the browser to work identically after the Phase 2 changes — confirmed in the previous session, not re-verified here since this is a read-only review.
- `saveAppStore`'s debounce holds only the latest pending store (not a queue), so rapid edits don't cause write amplification (`db.ts:51-76`).
- **The specific safety property the user asked about in §D holds**: an empty or failed boot cannot overwrite valid existing progress. `saveAppStore` is only ever called from the effect in `context.ts:65-70`, which is gated by `if (!bootedRef.current) return;`, and `bootedRef.current` is set to `true` only inside the `.then()` of a *successful* `loadAppStore()` call (`context.ts:52`). A failed boot leaves `bootedRef.current` at its initial `false` and no save can fire.

---

## 3. Risks

### 3.1 `firstCompletedAt` is not actually immutable (High)

`patchV2FromV1` (`store.ts:344-359`) runs on **every** dispatch and unconditionally overwrites both `firstCompletedAt` and `lastCompletedAt` from the v1 reducer's single `completedAt` field:

```ts
progress[id] = {
  ...base,
  ...
  firstCompletedAt: state.completedAt,
  lastCompletedAt: state.completedAt,
  ...
};
```

The v1 `TOGGLE_DONE` reducer case (`context.ts:20-21`) sets `completedAt: action.done ? todayISO() : null` — i.e. one nullable scalar, cleared on every uncheck. Walk the sequence:

1. Complete a question on day 1 → `completedAt = "day1"` → adapter writes `firstCompletedAt = lastCompletedAt = "day1"`.
2. Uncheck it later → `completedAt = null` → adapter writes `firstCompletedAt = lastCompletedAt = null`. The historical fact "first completed on day1" is now gone.
3. Re-complete it on day 50 → `completedAt = "day50"` → adapter writes `firstCompletedAt = lastCompletedAt = "day50"`.

The original completion date is unrecoverable. This matches the **pre-existing v1 behavior** exactly (the deployed app has always nulled `completedAt` on uncheck, and §7 explicitly says "un-checking is always free"), so it is not a regression. But it means the v2 field `firstCompletedAt` — whose name and stated purpose ("the date the question was first ever completed") implies permanence — cannot currently hold that meaning. The type promises more than the current data flow delivers.

This is a direct blocker for Phase 3, whose completion gate (§7) is specifically built around grandfathering and preserving completion history correctly.

### 3.2 The v1 reducer/adapter cannot express any Phase 3 write (High)

See §8 for the full breakdown. In short: `approach`, `pseudocode`, `code`, all six structured `notes.*` fields, and `mistakes` have no v1 equivalent and no `Action` case that can set them. The only way to get a value into any of these fields today is to bypass the reducer and write to `v2Ref.current` directly — a path that doesn't exist yet.

### 3.3 IndexedDB is the only durable copy of progress made after migration (High)

Once `loadAppStore()` completes its one-time migration, **the legacy `localStorage["dsa-tracker-progress"]` key is frozen forever** — nothing in Phase 2 ever writes to it again (confirmed: `saveStore`/`loadStore` in `store.ts` are still exported but no longer called anywhere in the boot or save path; grep confirms `saveAppStore`, not `saveStore`, is what `context.ts` calls). All progress made *after* the migration moment lives exclusively in IndexedDB.

If `get(APP_STORE_KEY)` in `db.ts:21` ever returns a false-negative — a transient IndexedDB read failure, the browser evicting IndexedDB under storage pressure (Safari's ITP eviction for non-installed sites is the classic case), or the user clearing "cookies and site data" in a way that clears IndexedDB but leaves localStorage intact — `shouldMigrate` will be `true` again, and the app will silently re-migrate from the **stale, frozen** legacy snapshot. The result is not an error: the app boots fine, shows a plausible-looking store, and quietly rolls the user back to their exact migration-day state, then resumes saving forward from there. Everything solved between the original migration and the data-loss event is gone, with no error, no warning, and no way to detect it after the fact from inside the app.

This is materially different from the pre-Phase-2 risk profile: localStorage loss was already possible (private browsing, quota, manual clearing) but had no "silently roll back to an old snapshot and keep going" failure mode — it either had the data or it had nothing. IndexedDB's extra durability tier, ironically, is what makes the *silent partial rollback* possible.

### 3.4 No schema validation on data read back from IndexedDB (Medium)

`loadAppStore()` trusts whatever `get(APP_STORE_KEY)` returns once `schemaVersion === 2`, with no structural check equivalent to `store.ts`'s `isValidStore()` for v1. A corrupted or hand-edited v2 record with `schemaVersion: 2` but a missing/malformed `progress` field would flow straight into `v2ProgressToV1Store()` (`context.ts:51`). In practice a `TypeError` inside that `.then()` callback is still caught by the following `.catch()` (synchronous throws inside a fulfilled handler are caught by a chained `.catch`), so the current failure mode is "show the error screen," not silent corruption — but this is incidental, not designed. There's no `isValidAppStoreV2()` guard and no way to distinguish "genuinely corrupt, needs re-migration" from "genuinely fine, just failed to read."

### 3.5 No in-flight guard on `loadAppStore()` (Low–Medium)

`loadAppStore()` has no mutex/shared-promise protecting it from concurrent invocation. Under React 19 StrictMode (dev only), the boot effect in `context.ts:45-63` mounts, cleans up, and re-mounts — if the first `loadAppStore()` call hasn't finished its `get`/`set` round-trip before the second one starts, **both** independently detect "not migrated yet," both re-read the same legacy localStorage, and both call `backupLegacy()` — which **downloads a duplicate backup file** to the user (`backup.ts:12`, `downloadBackupFile`). The end data state is not corrupted (both migrations compute the same result from the same source, and the second `set()` simply overwrites the first with an equivalent value), but the duplicate download is a real, user-visible rough edge. This is scoped to StrictMode/remount scenarios; production doesn't double-invoke effects by default, but nothing structurally prevents it if a future Suspense boundary or route remount triggers the same hook twice.

### 3.6 Multi-tab last-write-wins (Low, inherited)

Two tabs open simultaneously each hold an independent in-memory `v2Ref`, seeded once at boot with no cross-tab invalidation (no `BroadcastChannel`, no `storage` event equivalent for IDB). The tab that flushes last wins, silently discarding the other tab's changes. This limitation is **inherited from the original localStorage-based vanilla app**, which had the identical failure mode — Phase 2 doesn't introduce it, but doesn't fix it either.

### 3.7 `orphanedProgress` is currently write-only (Low)

Nothing in the codebase reads `orphanedProgress` back — not `v2ProgressToV1Store`, not any component, not an export path. Data lands there and is preserved byte-for-byte (good — nothing is dropped), but there is no UI or tooling that will ever surface it to the user again. "Never dropped" currently means "never dropped, and never seen again either."

### 3.8 Inconsistent error classification in `loadAppStore` (Low, cosmetic)

Only the `migrateV1ToV2()` call is wrapped in a try/catch that produces a `MigrationError` (`db.ts:40-45`). The `get()`/`set()` calls to IndexedDB itself are unwrapped — if IndexedDB is blocked or throws, the raw error propagates instead of a classified one. The outer `.catch()` in `context.ts:55` still catches it and shows the error screen either way, so this isn't a safety issue, just an accuracy-of-diagnosis issue (the error screen's message will be a raw IDB error string rather than something explicitly distinguishing "IDB unavailable" from "migration logic bug").

### 3.9 "Backup" is now three unrelated things sharing one name (Low, clarity)

1. `localStorage["dsa-tracker-progress-backup"]` — the pre-existing, actively-used one-shot undo-before-import/merge snapshot (`store.ts`'s `saveBackup`/`loadBackup`/`hasBackup`/`clearBackup`, driven by `ImportExport.tsx`/`MergeImport.tsx`).
2. `legacy-backup-v1` / `legacy-backup-v1-undo` in IndexedDB — Phase 2's one-time migration safety net, write-only (see 3.7's sibling issue — nothing reads these back either).
3. The downloaded `dsa-tracker-backup-<date>.json` file.

These don't overlap or conflict functionally (verified: import/export/merge/undo still correctly reads/writes the *first* one, which is unaffected by Phase 2), but three same-named, non-overlapping mechanisms is a maintenance hazard for whoever extends this next.

---

## 4. Missing fields

Against the plan's §5/§6 model and the user's specific question list:

- **`revisionCount`** — present, as `revisionStats.count` (per-question) and `TopicRevision.cycle` (per-topic, "successful passes"). Not missing.
- **`lastRevisedAt`** — present as `revisionStats.lastRevisedAt` (per-question); `TopicRevision.lastPassedAt`/`lastFailedAt` cover the topic-level equivalent. Not missing.
- **`nextRevisionAt`** — present as `TopicRevision.nextDueAt`. Correctly topic-scoped only (no per-question due date), matching §6's "unit = topic." Not missing.
- **Revision status** — by design **derived, never stored** (§6: `deriveState()`). Every state in the §6 table (`NOT_STARTED` … `MASTERED`) is computable from fields that already exist in `TopicRevision` plus completion% (computable from `progress` + `questions.json`, not itself a stored field). Not missing, but `deriveState()` itself doesn't exist yet — correctly deferred to Phase 4.
- **Revision evidence** — present via `RevisionAttempt.questions[]` (`approach`, `pseudocode`, `complexity`, `edgeCases`, `confidence`) and `.fundamentals[]`. Not missing.
- **Revision completion** — present via `RevisionAttempt.evaluationStatus`/`evaluation` and `TopicRevision.history[]`. Not missing.
- **Pattern/topic-level revision gates — GAP.** `TopicRevision` is keyed only by `topicId`. Plan §5 states the revision **unit is the topic** for questions but **the pattern** for Fundamentals ("Fundamentals = pattern (105); a topic session draws from its own patterns' fundamentals"). There is currently no schema slot for a pattern-scoped revision record — no `PatternRevision` type, and `TopicRevision.weakConcepts: Record<string, number>` has no namespacing to distinguish a fundamentals-concept id from a question id if both ever need weighting in the same structure. This needs a decision before Phase 5 (see §9); it does not block Phase 3, which doesn't touch revision routing at all.
- **Mandatory revision after >75% completion** — the threshold itself is meant to live in a static `config.ts` constant (`REVISION_CONFIG.completionThreshold`), not in the persisted schema, per plan §5's own text ("every tunable, referenced nowhere else as a literal"). That file doesn't exist yet. Not a `types.ts` gap; a Phase 4 file that hasn't been written yet, correctly out of Phase 2's scope.
- **Configurable 5/7-day threshold — open question, not a clear gap.** The plan's `intervalDays: [7, 14, 30, 60, 90]` is specified as a hardcoded array in a constants module, not a user-editable setting. `AppSettings` has no field for it. If "configurable" is meant literally — i.e. the *user* should be able to change the interval from Settings — that requires a new `AppSettings` field (e.g. `intervalDays: number[]`) that doesn't exist today. If "configurable" just means "defined once, not scattered as magic numbers," the current plan (a constants file) already satisfies it and no schema change is needed. **This needs the user to clarify intent before Phase 4** (Phase 3 doesn't touch scheduling).

---

## 5. Migration concerns

Walking each item from the user's checklist against `migrate.ts` and its tests:

| Item | Status | Evidence |
|---|---|---|
| Completed state | ✅ Correct | `completed: v1.done` (`migrate.ts:31`) |
| Completion dates | ✅ Correct at migration time, ⚠️ see 3.1 for post-migration mutation | `firstCompletedAt`/`lastCompletedAt` both set from `v1.completedAt ?? null` |
| Notes | ✅ Correct | `notes.legacy: v1.notes ?? ""`, other fields default `""` |
| Stars | ✅ Correct | `starred: v1.revise` |
| `starredAt` | ✅ Correct | `starredAt: v1.revisedAt ?? null` |
| Old `revisedAt` semantics | ✅ Correct — never treated as a revision event (see §1) | `revisionStats` hardcoded to nulls in `liftV1Entry` |
| Unmappable IDs | ✅ Correct | Routed to `orphanedProgress`, tested |
| `orphanedProgress` | ✅ Data preserved, ⚠️ write-only (§3.7) | — |
| Import/export compatibility | ✅ Verified compatible (see below) | `ImportExport.tsx`, `MergeImport.tsx` |

**Import/export compatibility — traced in detail.** `ImportExport.tsx` and `MergeImport.tsx` were not modified by Phase 2 and still operate entirely on the v1 `ProgressStore` shape via `useStore()`. Because `context.ts`'s reducer state is kept live as an accurate v1 projection of v2 (seeded at boot, patched on every change), `handleExport` still exports a faithful current snapshot; `handleImport`/`handleMerge` still dispatch `{type: "IMPORT", store: ...}`, which replaces the reducer's `store`, which the second `useEffect` (`context.ts:65-70`) then folds into `v2Ref.current` via `patchV2FromV1` and persists. `saveBackup`/`loadBackup`/`hasBackup`/`clearBackup` (the pre-existing one-shot undo mechanism) are untouched and continue to work against their own localStorage key, independent of the v2 migration. **No regression found here.**

One subtlety confirmed as *not* a bug: `patchV2FromV1` only ever adds/updates ids present in the incoming v1 store; it never deletes ids missing from it. This matches pre-existing v1 semantics exactly — an import/merge file has never contained entries for untouched problems, so "absent from the file" has always meant "leave alone," both before and after Phase 2.

**Confirmed: migration never fabricates an actual revision event.** No code path in `migrate.ts` or `store.ts`'s adapter functions writes to `revisionStats` from any v1 field. It is either hardcoded to nulls (fresh migration) or passed through unchanged from `base` (ongoing patches).

---

## 6. IndexedDB concerns

- **Atomicity**: the entire `AppStoreV2` is one JSON blob under one `idb-keyval` key, written with a single `set()` call — atomic at the IndexedDB transaction level (all-or-nothing per write). Matches the plan's intended shape (§3).
- **Debounced writes**: 400 ms, single-slot `pending` (not a queue) — later writes correctly supersede earlier ones, no write amplification (`db.ts:51-76`).
- **Merge behavior**: `patchV2FromV1` correctly preserves v2-only fields it doesn't understand (spreads `base` first) — see §3.1 for the one field pair it does *not* handle correctly (`firstCompletedAt`/`lastCompletedAt`).
- **Concurrent updates (cross-tab)**: unguarded, last-write-wins — inherited risk, not new (§3.6).
- **Boot/loading race conditions**: the `cancelled` flag correctly prevents a stale boot promise from calling `setState` after unmount, and `bootedRef` correctly prevents any save before a successful boot (this is the mechanism that answers the user's central question — see §2's last bullet and below). However, `loadAppStore()` itself has no in-flight guard against being called twice concurrently (§3.5).
- **Migration failure handling**: correctly leaves IDB untouched (verified in code and by test `db.test.ts:65-75`).
- **Recovery/export behavior**: the error screen's export button reads directly from `localStorage["dsa-tracker-progress"]` (`App.tsx:56`), not from IDB — correct, since on the failure path IDB was never written, so localStorage is the only valid source at that moment.

### Direct answer to: *"Could a failed or partially initialized IndexedDB state cause existing user progress to be replaced with an empty state?"*

**No — not through the boot path that exists today.** The only function that persists to IDB during normal operation is `saveAppStore`, and it is only ever invoked from the effect at `context.ts:65-70`, which unconditionally returns early — `if (!bootedRef.current) return;` — until a `loadAppStore()` call has *already succeeded*. A failed or slow boot leaves `bootedRef.current` at its initial `false`, so no empty or partial state can ever be written over real data through that path.

The real risk is not "empty state overwrites data" — it's the subtler failure in §3.3: a *false-negative read* of an already-migrated IDB record causes a full, successful, no-error re-migration from the stale frozen localStorage snapshot, silently resetting progress to migration-day state rather than to empty. It looks like a successful boot, not a failure, which makes it harder to notice than an outright overwrite would be.

---

## 7. Adapter concerns

The `v2ProgressToV1Store` / `patchV2FromV1` pair (`store.ts:330-359`) is a clean, well-isolated seam — two functions, one direction each, with a clear comment explaining the intent (preserve v2-only fields, patch don't replace). It does exactly what it was built for: let Phase 2 land without touching a single UI component.

Its limitation is structural, not a bug in the code that exists: **the adapter can only carry information that the v1 `ProgressStore`/`Action` shape is capable of representing.** `ProblemState` has exactly five fields (`done`, `revise`, `notes`, `completedAt`, `revisedAt`), and the `Action` union has exactly three mutating cases (`TOGGLE_DONE`, `TOGGLE_REVISE`, `SET_NOTES`). Anything in `QuestionProgressV2` beyond what those five fields can express — `approach`, `pseudocode`, `code`, the six structured `notes.*` fields, `mistakes`, and (per §3.1) a truly immutable `firstCompletedAt` — cannot be written through this adapter at all, by construction, not by oversight.

---

## 8. Compatibility with Phase 3

Phase 3's stated scope (plan §15, §7): **notes editor, mistakes, dates, completion gate.**

| Phase 3 feature | Needs | Can the current v1 adapter carry it? |
|---|---|---|
| Structured notes editor (`approach`, `keyInsight`, `commonMistake`, `complexity`, `edgeCases`, `reminder`) | Direct v2 write | **No.** `SET_NOTES` only ever sets `notes.legacy` via the single v1 `notes: string` field. There is no v1 field for any structured note. |
| Mistakes list | Direct v2 write | **No.** No v1 equivalent exists at all. |
| Completion dates (correct first-vs-last semantics) | Direct v2 write, or a redesigned patch function | **No, as currently written.** §3.1: the adapter overwrites both `firstCompletedAt` and `lastCompletedAt` from one v1 scalar on every dispatch, so they can never actually diverge. |
| Completion gate (block "done" without `pseudocode`/`code`; grandfather pre-existing completions) | Direct v2 read (to check the gate condition) + a new write path | **No.** The gate needs to read `pseudocode`/`code` — fields that don't exist in the v1 view at all — before allowing `TOGGLE_DONE` to fire, and the "grandfathered" rule needs to distinguish "already completed at migration" from "completed after the gate existed," which isn't tracked anywhere today. |
| `approach` field | Direct v2 write | **No.** Same as notes — no v1 equivalent. |

**Conclusion: none of Phase 3's four sub-features can be built on top of the current adapter as-is.** Every one of them needs either new `Action` cases that write directly into `v2Ref.current` (bypassing `patchV2FromV1` for those specific fields), or a more fundamental inversion where the reducer operates on the v2 shape directly and the v1 `ProgressStore` becomes a pure, read-only projection derived from it for the parts of the UI that still need it (filtering, heatmap, streak). The adapter is *safe to keep* for what it already does — it should not be deleted, since ripping it out would re-break every already-working feature that Phase 3 doesn't touch — but it is **not sufficient on its own**, and Phase 3 cannot start with "just add UI on top of what's there."

---

## 9. Required changes before Phase 3

These are decisions/changes needed before Phase 3 implementation starts, not code written now (per your instruction, nothing has been implemented):

1. **Decide the write architecture for v2-only fields.** Either (a) add new `Action` cases (e.g. `SET_PSEUDOCODE`, `SET_APPROACH`, `ADD_MISTAKE`, `COMPLETE_WITH_EVIDENCE`) that patch `v2Ref.current` directly and are exempted from the blanket `patchV2FromV1` overwrite, or (b) make the v2 store the reducer's primary state and derive the v1 view outward instead of patching it inward. (a) is the smaller diff against what exists; (b) is architecturally cleaner and avoids a second parallel write path but touches more of `context.ts`.
2. **Fix `firstCompletedAt`/`lastCompletedAt` semantics** so that `firstCompletedAt` is set once and never overwritten by a subsequent toggle, while `lastCompletedAt` updates on each new completion. This has to be part of whichever write path is chosen in (1), since the current blanket-overwrite is what causes §3.1.
3. **Decide the completion-gate/grandfathering rule concretely**: what marks a `QuestionProgressV2` entry as "grandfathered" (completed before the gate existed) versus subject to the new pseudocode/code requirement? Nothing currently distinguishes these. A boolean flag or a "gate version" stamp is the likely shape, but it needs to be decided before the gate is built, not discovered mid-implementation.
4. **Decide on the IndexedDB durability question (§3.3)**: is a periodic v1-shaped mirror back to localStorage worth keeping as a durability fallback (at the cost of reintroducing localStorage's own quota ceiling for that mirror), or is IndexedDB accepted as the sole source of truth going forward, relying on user-initiated Export for durability? This doesn't block Phase 3's UI work directly, but it gets harder to retrofit the longer real user data accumulates only in IDB.

Lower-priority, worth doing but not blocking Phase 3 starting:

5. Add `isValidAppStoreV2()` validation on the IDB read path (§3.4).
6. Add an in-flight guard to `loadAppStore()` (a shared in-progress promise) to eliminate the duplicate-download edge case (§3.5).

Explicitly **not** required before Phase 3 (correctly out of scope / correctly deferred):

- `PatternRevision` / pattern-level gate schema (§4) — only needed before Phase 5.
- `REVISION_CONFIG` constants file, `deriveState()` — Phase 4.
- LLM response schema/zod validation — Phase 7.
- Multi-tab sync (§3.6) — pre-existing limitation, not worsened by Phase 2.

---

## 10. Recommended final v2 model

The schema itself does **not** need new fields for Phase 3 (notes/mistakes/pseudocode/code/approach all already exist on `QuestionProgressV2` exactly as specified in plan §11). The changes needed are to the *write path* around the schema, not the schema shape:

- Keep `QuestionProgressV2`, `TopicRevision`, `RevisionAttempt`, `AppSettings` as they are — they match plan §11 closely and no gaps were found against Phase 3/4/6/7's stated needs for per-question or per-topic revision data.
- Add, before Phase 5 (not Phase 3): a pattern-scoped revision record (either a generalized `unitType: "topic" | "pattern"` on a renamed `RevisionUnit`, or a parallel `patternRevision: Record<string, PatternRevision>` map alongside `revision`) to represent Fundamentals' pattern-level gating distinctly from topic-level question gating.
- Add, only if the interval truly needs to be user-configurable rather than a code constant (pending your answer to the open question in §4): an `intervalDays: number[]` (or similar) field on `AppSettings`.
- Replace the current single-direction "patch every field from v1 on every dispatch" adapter logic for `firstCompletedAt`/`lastCompletedAt` with logic that sets `firstCompletedAt` only when it is currently `null` and always sets `lastCompletedAt` — whichever write-path decision from §9.1 is chosen should implement this rule at the point where `completed` transitions from `false` to `true`, not by blanket-copying a single v1 scalar.

---

## Verdict

CHANGES_REQUIRED_BEFORE_PHASE_3
