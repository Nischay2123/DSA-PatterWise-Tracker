# Phase 3 Post-Implementation Audit

Read-only. No files were modified to produce this report. Every claim below was checked against the actual source at the pinned commits — not recalled from the prior `PHASE_3_REPORT.md`, which is treated here as an unverified claim, not a source of truth.

**Commit hash correction, checked first.** The commit you called out as "Phase 3: `902dac3`" is not on `feat/revision-system` — it exists only as a dangling object (visible via `git reflog`, not yet garbage-collected). It was the pre-amend version of the Phase 3 commit; amending it (to fix a self-referential commit hash inside `PHASE_3_REPORT.md`) produced `4e95cea`, which is what the branch actually points to. `git diff 902dac3 4e95cea --stat` shows exactly one line changed, in `PHASE_3_REPORT.md`, nowhere else — every source file is byte-identical between the two hashes. This audit treats them as equivalent for code purposes and cites `4e95cea` as the real Phase 3 commit going forward.

Files read at the pinned commit (not from memory): `DSA_TRACKER_IMPLEMENTATION_PLAN.md` (Context, §5, §6, §7, §11, §12, §13, Decisions 1-20, "What Sonnet must NOT change"), `PHASE_3_REPORT.md`, `src/types.ts`, `src/store.ts`, `src/context.ts`, `src/App.tsx`, `src/components/{QuestionRow,CompletionPanel,SolutionEditor,NotesEditor,MistakeList,ImportExport,MergeImport}.tsx`, `src/persistence/{db,migrate,backup}.ts`, `src/store.test.ts`, and at HEAD (`d19d71b`): `src/config.ts`, `src/revision/{stateMachine,scheduler,scoring,dates,selection}.ts` and their tests.

---

## 1. Executive verdict

Phase 3's completion-gate mechanism itself is **correctly implemented** and matches the plan closely, including several places where the plan was ambiguous and a defensible, documented choice was made instead of a silent guess. However, this audit found **one confirmed, high-severity bug that was not disclosed in the prior Phase 3 report**: the Export function (the app's only described backup mechanism) silently omits every field Phase 3 introduced — pseudocode, code, approach, all six structured notes, and mistakes. A user who writes an hour of pseudocode and notes, then exports "as a backup" per the app's own footer copy, gets a file that cannot restore any of it. This is live today, not a future risk.

Phase 4 is architecturally decoupled from Phase 3 cleanly (it never reads `QuestionProgressV2` at all — `completionPct` is passed in as a plain number by a caller that doesn't exist yet), so there is no Phase 3 defect that Phase 4 depends on or inherits. But Phase 4 does surface one unresolved **coordination gap between the two phases**: Phase 3's evidence gate and Phase 4's revision-due gate are both "reasons a checkbox click might be blocked," and nothing yet composes them — that composition doesn't exist in either phase, and whoever builds it (Phase 6) needs to know both gates exist and must be checked in the right order.

**Verdict: `PHASE_3_REMEDIATION_REQUIRED`** — see §10 for exactly what, §11 for order.

---

## 2. Phase 3 requirement matrix (against the approved plan)

| Requirement (plan §7 / §11 / §12 / §13) | Plan says | Actual implementation | Test coverage | Status |
|---|---|---|---|---|
| Completion gate exists | "Clicking the checkbox opens a small completion panel... instead of toggling instantly" | `QuestionRow.handleCheckboxChange` opens `CompletionPanel` only when `canCompleteFreely` is false; otherwise toggles instantly | `canCompleteFreely` unit-tested (4 tests); UI behavior verified live | **PASS**, with one documented interpretation (see §9 row 1) |
| Evidence = pseudocode OR code | "requires non-empty `pseudocode` **or** `code`" | `hasCompletionEvidence` = `pseudocode.trim() \|\| code.trim()` | 4 unit tests incl. whitespace-only | PASS |
| Migrated completions grandfathered | "every question already `completed` at migration is grandfathered — never retroactively invalidated, never un-completed, editable but not re-gated" | `canCompleteFreely` returns true whenever `firstCompletedAt !== null` | Tested directly; verified live via IDB read after uncheck/recheck | PASS |
| Un-checking always free | "Un-checking is always free" | `handleCheckboxChange`'s `!checked` branch dispatches `TOGGLE_DONE` unconditionally, no gate check at all | Verified live | PASS |
| `requireEvidence` toggle | "defaults `true` and can be turned off" | `canCompleteFreely` short-circuits on `!settings.requireEvidence`; when false, `CompletionPanel` never opens (not just unvalidated) | 1 direct test | PASS |
| Structured notes fields | "Approach / Key Insight / Common Mistake / Complexity / Edge Cases / Personal Reminder" | `NotesEditor` renders exactly these 6, keyed off `StructuredNoteField` | Indirectly via `hasNotes`/`v2Reducer` tests; no dedicated NotesEditor test (none possible — no component tests, decision #12) | PASS |
| "Previous notes" (legacy) shown first, read-only | "the preserved `legacy` blob rendered as a 'Previous notes' field at the top" | `NotesEditor` renders it first, as a `<div>` (not editable) | Verified live; no dedicated automated check that it's specifically *first* in DOM order beyond visual confirmation | PASS |
| Nothing parsed out of legacy text | "Nothing is parsed out of legacy text" | Legacy is only ever copied verbatim (`notes.legacy: state.notes`); never split/parsed anywhere in `store.ts` | 2 explicit "byte-identical" tests | PASS |
| Notes indicator extended, not duplicated | "`hasNotes` must become 'any structured field OR legacy non-empty'... Extend that existing affordance; do not invent a parallel one" | `hasNotes` = `Object.values(notes).some(v => v.trim())`; same single "details" button, same `•` convention | 4 unit tests | PASS |
| Mistakes shape | `{ at: ISO, what: string, remember: string }[]` | Matches exactly; `at` is a full ISO timestamp (plan says "ISO", doesn't specify day vs. instant granularity) | `ADD_MISTAKE`/`REMOVE_MISTAKE` tested (2 tests) | PASS |
| `RevisionAttempt`/`TopicRevision` untouched | Phase 3 files list doesn't include these | Confirmed unchanged in `types.ts` between Phase 2 and Phase 3 | N/A | PASS |
| Files match the plan's list | `components/{QuestionRow,NotesEditor,CompletionPanel,MistakeList}.tsx`, `store.ts`, `config.ts` | All four components exist; **plus** an un-planned fifth, `SolutionEditor.tsx`; **`config.ts` was not created in Phase 3** (it was created in Phase 4) | N/A | PARTIAL — see note below |
| Test list: grandfathered never re-gated | §13 | Tested directly, 2 angles (uncheck/recheck cycle, and gate-version stays null) | Covered | PASS |
| Test list: gate blocks empty-evidence completion | §13 | Tested directly | Covered | PASS |
| Test list: `requireEvidence:false` bypasses | §13 | Tested directly | Covered | PASS |
| Test list: legacy notes byte-identical after unrelated edit | §13 | Tested directly, 2 variants | Covered | PASS |
| Export/import/merge extended to carry v2 fields | Not a Phase 3 requirement — explicitly Phase 8's job ("merge extended to the v2 shape... Phase 8's job") | **Not done** — and not claimed as done | N/A (correctly out of Phase 3 scope) | **N/A, but see §7 — the *absence* has an active, unflagged consequence right now** |

**Note on `config.ts`:** the plan's Phase 3 file list includes `config.ts` — that file did not exist until Phase 4. This is a **sequencing mismatch, not a functional defect**: nothing in the actual Phase 3 gate logic needs a config constant (the gate is boolean logic, not a tunable), so its absence didn't block anything. But it means the "Files" column of the plan's Phase 3 row doesn't literally match what got built when — worth noting precisely since the user asked for a literal comparison, not just a functional one.

---

## 3. Original product requirement matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Existing functionality remains intact | **PASS** | Verified live in the Phase 3 session (search, accordions, star, heatmap, analytics); independently re-confirmed here by reading `isProblemVisible`, `mergeStores`, heatmap functions in `store.ts` — none were touched by Phase 3's diff |
| 2 | Question completion evidence | PASS | §2 above |
| 3 | Pseudocode requirement | PASS | Either pseudocode or code, per plan — see §2 |
| 4 | Code requirement | PASS | Same function, code alone sufficient |
| 5 | Notes / revision notes | **PARTIAL — needs a terminology distinction** | Phase 3 implements *personal* structured notes (`NotesEditor`). "Revision notes" in the spaced-repetition sense (notes captured *during a revision session*, per `RevisionAttempt`) don't exist yet and aren't Phase 3's job — Phase 6's. If "revision notes" in the original request meant the personal notes, this is PASS; if it meant session notes, it's correctly NOT_STARTED, not missing |
| 6 | Dates | **PASS, with one undocumented interpretation** | `firstCompletedAt` immutable-once-set: verified correct. `lastCompletedAt` is *not* cleared on uncheck (preserved from the last real completion) — this is a Sonnet interpretation from the Phase 2 remediation, not literal plan text (the plan only defines `lastCompletedAt` for the migration mapping, not its ongoing uncheck semantics) — see §9 |
| 7 | Mistakes | PASS | §2 above |
| 8 | ★ bookmark independent from revision | **PASS, verified directly in code, not just tests** | `patchV2FromV1` sets `starred`/`starredAt` only from `state.revise`/`state.revisedAt`; nothing in the star-toggle path touches `revisionStats`, `completionGateVersion`, or `mistakes`. Confirmed by direct code reading in this audit |
| 9 | Existing completed questions don't unexpectedly become blocked | PASS | `canCompleteFreely`'s first condition (`firstCompletedAt !== null`) exempts *any* previously-completed question regardless of how it was completed — migration, Phase 2-era instant toggle, or the new gate |
| 10 | Re-completion behavior | PASS | Verified live: instant, no panel, `completionGateVersion` resets to `null` (not re-verified as gate-passed) |
| 11 | Import/export behavior | **CONFIRMED BUG — see §4/§7** | `ImportExport.tsx`'s `handleExport` serializes `store` (the v1 view), never `v2Store`. Pseudocode/code/approach/structured notes/mistakes are absent from every exported file |
| 12 | Merge/undo behavior | **DESIGN GAP, plan-acknowledged** | `mergeStores` operates on v1 `ProgressStore` only; v2-only fields pass through unmerged (whatever the *current* device already had survives; the *incoming* device's v2 data is never read, since it was never in the merged file to begin with — see §4). This is explicitly Phase 8's stated job, not a Phase 3 regression, but it means "merge" today is really "merge the old fields, keep this device's new-field content" without saying so anywhere in the UI |
| 13 | IndexedDB persistence | PASS | `v2Reducer`/`patchV2FromV1` both flow through the same `saveAppStore` debounce path already verified in Phase 2; nothing about Phase 3 changes persistence timing or triggers |
| 14 | Migration/recovery | PASS, unaffected | Phase 3 didn't touch `db.ts`; the stale-localStorage recovery path was re-verified live after Phase 3 shipped and still works |
| 15 | Mobile/responsive UI | Plan doesn't specify anything Phase-3-specific here beyond the existing `[@media(pointer:coarse)]` touch-target classes already on the checkbox/star/notes buttons (Phase 1B). `CompletionPanel`/`SolutionEditor`/`NotesEditor`/`MistakeList` use plain `<textarea>`/`<input>` with no coarse-pointer sizing added | **Not addressed, not required** | The plan's only mobile-specific text is about the filter disclosure (§12), not the new Phase 3 panels. Not a violation, but not verified either — no live mobile-viewport check was done for the new components |
| 16 | Accessibility | **Not addressed beyond what already existed** | The checkbox gained `aria-expanded={completionPanelOpen}` (a real, if minor, addition). None of the four new components have `aria-label`s on their inputs; they rely on visible `<label>` elements, which is acceptable but wasn't explicitly verified against the plan's a11y bar because the plan doesn't set one beyond what's already deployed |

---

## 4. Completion-gate audit (Part 3, verbatim answers)

**A. When does a question become gated?** Only at the moment of a `false → true` checkbox transition, and only when both: (i) `firstCompletedAt === null` (never completed before, by any mechanism), and (ii) `settings.requireEvidence === true`. Every other transition (uncheck, re-check of anything ever completed, or any completion while the setting is off) is never gated.

**B. What counts as completion evidence?** `pseudocode.trim().length > 0 || code.trim().length > 0`. Nothing else — not `approach`, not any structured note field, not a mistake entry.

**C. Is pseudocode OR code sufficient?** Yes, either alone. Confirmed in code (`hasCompletionEvidence`) and by a dedicated test for each independently.

**D. Are notes required?** No. Never checked by the gate.

**E. Exact behavior per category, traced through the actual code:**
- *Never-completed questions*, evidence required, none given → `CompletionPanel` opens, checkbox stays visually unchecked, no dispatch fires until "Mark complete" is clicked with evidence present.
- *Migrated completed questions* → `firstCompletedAt` is non-null from migration (`liftV1Entry`), so `canCompleteFreely` is true unconditionally; any future uncheck/recheck is instant.
- *Questions completed under the old system* (Phase 0-2, before the gate existed — including, notably, any questions I checked off during this project's own Phase 2 live-browser testing) → identical treatment to migrated questions, since the exemption is keyed on "has `firstCompletedAt` ever been set," not "was this from the original vanilla-app migration specifically." This is a **reasonable, documented extension of decision #9's literal wording** ("migrated completions grandfathered") to "any already-completed completions" — the plan's decision #9 doesn't literally cover this case, but the spirit (never invalidate real history) clearly does.
- *Questions completed under the new gate* → `completionGateVersion` set to `1` at the moment of completion, provided evidence was present.
- *Unchecked questions* → `completed: false`, `firstCompletedAt` preserved, `lastCompletedAt` preserved (not cleared — see §9), `completionGateVersion` preserved (whatever it was).
- *Re-completed questions* → instant (exempt via `firstCompletedAt !== null`), `lastCompletedAt` updates to the new date, `completionGateVersion` resets to `null` regardless of whether evidence exists at that moment — a re-check is never treated as gate-verified, even if the user happens to have pseudocode sitting in `SolutionEditor` already.

**F. Does `completionGateVersion` have correct semantics?** The *stamping* logic is correct and precisely matches its own doc comment. But there is a real observation worth surfacing: **nothing in the codebase ever reads `completionGateVersion` for any decision.** `canCompleteFreely` — the only gating logic that exists — checks `firstCompletedAt`, not `completionGateVersion`, at all. The field is currently pure write-only telemetry. This isn't a bug (the field was explicitly requested during the Phase 2 remediation as forward-looking infrastructure, "for future schema evolution," and the remediation report said so at the time), but it means as of today, `completionGateVersion` has zero behavioral effect — deleting every reference to it would not change the app's behavior at all. Flagged as a **DESIGN GAP**, not a bug: it's inert infrastructure, not incorrect infrastructure.

**G. Does the actual behavior match the intended grandfathering rule?** Yes. The intended rule (from the plan and from the Phase 2 remediation's own stated design) is "never re-gate anything that has ever been completed," and `firstCompletedAt !== null` is exactly that check, correctly implemented and correctly tested.

**H. Can import/merge bypass the gate — and is that explicitly allowed?** Yes, it bypasses completely: `ImportExport.tsx`/`MergeImport.tsx` dispatch `{type: "IMPORT", store: ...}` directly to the v1 reducer, which unconditionally sets `done: true` for anything the incoming file says is done — no call to `canCompleteFreely` anywhere in that path. This is **not explicitly stated in the plan** (decision #6, "Gating restricts only new completions," is written in the context of the interactive checkbox flow, and doesn't discuss bulk data restore at all). It is, however, an **ACCEPTABLE IMPLEMENTATION CHOICE**: gating a data-restore operation would actively harm a legitimate use case (restoring your own already-earned progress onto a device that happens to lack your pseudocode). Classified as acceptable-but-not-plan-confirmed, not as a bug.

---

## 5. Data-model audit

Checked every field the user listed, against both its Phase 2 origin and its Phase 3 usage:

| Field | Consistent Phase 2 → Phase 3? | Note |
|---|---|---|
| `firstCompletedAt` | Yes | Semantics fixed in the Phase 2 remediation (immutable-once-set), Phase 3 relies on exactly that fix and doesn't alter it |
| `lastCompletedAt` | Yes, but see the uncheck-preservation note in §3/§9 | Not cleared on uncheck — a remediation-era interpretation, unchanged by Phase 3 |
| `completionGateVersion` | Yes in stamping logic; **inert in consumption** (§4.F) | Introduced in the remediation, populated correctly by Phase 3's gate, read by nothing |
| `approach` (top-level) | Consistent | Written by both `CompletionPanel` and `SolutionEditor`; both correctly target the top-level field, not `notes.approach` |
| `pseudocode` | Consistent | Same field, written from two components, both correct |
| `code` | Consistent | Same |
| `notes.legacy` | Consistent, verified byte-identical under edits to other fields | Never mutated once migrated |
| Structured notes (5 fields other than `approach`) | Consistent | `NotesEditor` is the only writer |
| `mistakes` | Consistent | `MistakeList` is the only writer; `at` is a full ISO timestamp, which is *more* granular than the plan's "ISO" wording requires but not inconsistent with it |
| `starred` / `starredAt` | Consistent, verified independent of everything above | §3 item 8 |
| `revisionStats` | Consistent — **never written by anything in Phase 2, 3, or 4** | Still fully at its default-null shape everywhere in the codebase. Confirmed by grep: no `revisionStats:` assignment exists outside its own default-value initializers |
| `TopicRevision` | Consistent — untouched by Phase 3, read/written only by Phase 4's pure functions, never by any component | No conflict possible; nothing wires them together yet |
| `RevisionAttempt` | Consistent — completely unused by any phase so far except as a type declaration | No conflict possible |

**One inconsistency worth naming precisely**, because the user asked specifically to look for it: the naming duplication between top-level `approach` and `notes.approach`. This was inherited from the *original Phase 2 schema* (§11 of the plan literally lists both), not introduced by Phase 3. Phase 3 correctly implemented both as separate fields with separate UI surfaces (`SolutionEditor`/`CompletionPanel` for the former, `NotesEditor` for the latter). It's a naming confusion in the approved plan itself, faithfully carried through, not a Phase 3 defect.

---

## 6. Phase 4 compatibility audit

Phase 4's four modules (`stateMachine.ts`, `scheduler.ts`, `scoring.ts`, `selection.ts`) were checked for any assumption that could conflict with what Phase 3 actually built:

- **Completion percentages / `completionPct`**: `deriveState` takes this as a plain `number` parameter — it never touches `QuestionProgressV2` at all. There is no code path in Phase 4 that computes completion from `.completed` flags; that's left entirely to a future caller (Phase 6). **No coupling, no conflict possible.**
- **`firstCompletedAt`/`lastCompletedAt`/`completionGateVersion`**: none of these three fields are referenced anywhere in `src/revision/*` or `src/config.ts`. Confirmed by direct reading, not by trusting the Phase 4 report's claim of decoupling.
- **`TopicRevision`**: used exactly as Phase 2 defined it; Phase 4 adds no new fields and doesn't rename or repurpose any existing one.
- **`revisionStats`**: not referenced by Phase 4 either. `computeQuestionWeight` (selection.ts) takes a `lastRevisionScore`/`lastConfidence` on its own `SelectionCandidate` interface — a *separate*, not-yet-wired shape — rather than reading `QuestionProgressV2.revisionStats` directly. This is fine architecturally (decoupled, testable) but means **the mapping from `revisionStats` → `SelectionCandidate` doesn't exist yet and needs to be written by whoever builds the Phase 6 session caller.** Not a bug; a to-do that isn't tracked anywhere yet.
- **Revision state transitions / exempt behavior**: `deriveState`'s `isExempt` parameter is a boolean the caller must supply by checking `REVISION_CONFIG.exemptTopics.includes(topicId)` — this check doesn't exist anywhere yet either (Phase 4 doesn't call itself with a real topic id). Confirmed correct in isolation (tested with `isExempt: true`/`false` directly), but, again, unwired.
- **Zero-core pattern (`fundamentals__logical-thinking`)**: independently re-verified against the real `data/fundamentals.json` in this audit (not re-trusting the Phase 4 report) — confirmed exactly one pattern has zero `core` concepts, all 5 of its concepts are `supporting`, and `scoring.ts`'s `passesCriticalFloor` correctly returns `true` vacuously for an empty `core` array via `Array.prototype.every`.
- **Single-`expectedConcepts` patterns (62 of them)**: independently re-counted from the real file in this audit — confirmed 62. `scoring.ts` never reads `expectedConcepts` at all (it operates on already-produced 0-5 scores), so this fact cannot affect Phase 4's logic one way or the other; it's a Phase 7 (LLM prompt) concern, correctly untouched.

**The one real coordination gap, stated precisely as the user asked:** plan §6 defines gating as "blocked: marking a not-yet-completed question in that topic as done" — this is the *same class of user action* that Phase 3's evidence gate also intercepts. Once Phase 6 exists, a single checkbox click could be affected by **two independent, unrelated gates**: "is this question missing evidence" (Phase 3, per-question) and "is this topic revision-due/failed" (Phase 4's `isTopicGated`, per-topic). Neither phase composes with the other — `QuestionRow.handleCheckboxChange` has no knowledge of `isTopicGated`, and `isTopicGated` has no knowledge of the evidence gate. This is not a bug in either phase (each is correct on its own), but it is exactly the kind of **"Phase 3 completion semantics conflicting with Phase 4 revision semantics"** risk the user asked to be watched for, and it is currently unresolved and untracked anywhere. Whoever builds Phase 6 needs to explicitly decide the precedence (a plain reading of the plan suggests the topic-level revision gate should be checked first and disable the checkbox outright — a different, stronger UI treatment than opening `CompletionPanel` — before the evidence gate is even relevant).

---

## 7. Bugs

**CONFIRMED BUG (high severity) — Export silently drops every Phase 3 field.**

`src/components/ImportExport.tsx`, `handleExport`:
```ts
const { store, dispatch } = useStore();
const handleExport = () => {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  ...
```
`store` here is the v1-shaped `ProgressStore` (confirmed: `useStore()` returns `{store, dispatch, v2Store, dispatchV2}`, and this component destructures only `store`/`dispatch`). `ProblemState` has exactly five fields: `done, revise, notes, completedAt, revisedAt`. Every field Phase 3 introduced — `approach`, `pseudocode`, `code`, all six structured note fields, `mistakes`, and `completionGateVersion` — has no representation anywhere in a v1 `ProblemState`, so **none of it can possibly appear in an exported file, ever, regardless of how much of it exists.**

The same applies to `saveBackup(store)` (used by both Import's pre-overwrite backup and Merge's pre-merge backup) — the internal "Undo import" safety net is *also* v1-only, so undoing an import restores pre-Phase-3 data even for fields that were never touched by the import itself.

Why this matters more than a typical "not yet extended" gap: the app's own footer text says *"Progress is saved in this browser only — no account, no sync. Use Export regularly as a backup."* That sentence is the app's explicit promise to the user about what Export is for. As of Phase 3, that promise is false for a growing share of what the user actually enters into the app. This is live and exploitable **today** — no future phase needs to ship for a user to lose real work; they just need to write pseudocode, export, clear their browser, and re-import.

**Why 160 passing tests didn't catch this:** this project's own testing policy (plan decision #12: *"Vitest on pure logic only. No component/E2E tests"*) means nothing tests what data a UI *action* (clicking Export) actually feeds into a pure function. `mergeStores`/`isValidStore`/etc. are correctly tested for what they do with whatever `ProgressStore` they're given — the gap is entirely in `ImportExport.tsx` handing them the wrong object, which is exactly the class of defect this project's test strategy is structurally unable to see. Not a testing failure; a known blind spot that this specific bug happens to fall into.

**No other confirmed bugs were found.** The completion-gate logic itself, `patchV2FromV1`'s date/version stamping, `hasNotes`, and the star/revision independence were all independently re-verified against the actual code (not re-trusted from the prior report) and found correct.

---

## 8. Design gaps

1. **`completionGateVersion` is currently inert** (§4.F) — stamped correctly, read by nothing. Not wrong, just not yet load-bearing.
2. **Merge does not merge v2-only fields** (§3 item 12) — explicitly Phase 8's job per the plan, so not a Phase 3 defect, but worth tracking so it isn't forgotten.
3. **`revisionStats` → `SelectionCandidate` mapping doesn't exist** (§6) — needed before Phase 6's session caller can use Phase 4's `selection.ts` for real.
4. **Evidence gate × revision-due gate composition doesn't exist** (§6) — the most important one; needs an explicit precedence decision before Phase 6.
5. **No mobile-viewport or accessibility verification was done for the four new Phase 3 components** (§3 items 15-16) — not a violation of anything the plan asked for, but also not confirmed either way.

---

## 9. Ambiguities (not silently resolved — flagged for your decision)

1. **Does "editable but not re-gated" extend past literal migration to *any* prior completion (including ones made during this project's own Phase 2 testing, before the gate existed)?** The current implementation says yes (`firstCompletedAt !== null` is the only test). The plan's decision #9 literally says "migrated completions" only. I believe the broader reading is clearly intended (the alternative — retroactively demanding evidence for pre-gate completions — would contradict "never retroactively invalidated" even more directly) but it was never explicitly confirmed by you.
2. **Should `lastCompletedAt` clear on uncheck?** Current behavior: no, it's preserved. The plan defines `lastCompletedAt` only for the migration mapping; it says nothing about its behavior across a live uncheck/recheck cycle, because v1 never had this two-date distinction to begin with. This was a genuine judgment call made during the Phase 2 remediation, documented there, but never put to you as an explicit question.
3. **Should re-checking a grandfathered/previously-passed question ever be gate-verified again, e.g., if the user happens to already have fresh evidence sitting in `SolutionEditor`?** Current behavior: no, `completionGateVersion` always resets to `null` on any re-check, even with evidence present. Defensible (a re-check isn't "new learning"), but not explicitly stated by the plan.
4. **Is import/merge bypassing the gate entirely the intended behavior**, or should a restored `done: true` with no evidence at least be flagged somehow (e.g., a distinguishable `completionGateVersion` state meaning "restored, unverified")? Current implementation treats it identically to a grandfathered completion. Reasonable, but not plan-confirmed (§4.H).

---

## 10. Required remediation

**Required before this is safe to build further on:**

1. **Fix Export to include the full `v2Store`, not the v1 projection** — or, at minimum, warn the user explicitly that Export currently omits pseudocode/code/notes/mistakes, until a real fix ships. Silent data loss on the officially-documented backup path is not acceptable to leave unresolved. This is the one item this audit considers a hard blocker.
2. **Fix (or explicitly accept and document) the same gap in `saveBackup`** (the Undo-import safety net), since it has the identical root cause.

**Should be resolved, but does not block correctness today:**

3. Decide and document whether `completionGateVersion` is meant to ever be *read* by something, or whether it's permanently descriptive-only telemetry — so nobody later builds logic assuming it's authoritative when `firstCompletedAt` actually is.
4. Decide the evidence-gate × revision-due-gate precedence (§6, §8.4) before Phase 6 starts, so it's designed in rather than discovered mid-implementation.
5. Resolve the four ambiguities in §9 explicitly, even if the answer is "the current behavior is fine" — so they're confirmed decisions, not accidental ones.

---

## 11. Recommended order of fixes

1. Export/backup fix (§10.1-2) — data-safety, do this first, before any other work touches the store.
2. Confirm §9's four ambiguities with the user (cheap, no code, unblocks confident design of Phase 6).
3. Document the `completionGateVersion` inertness decision (§10.3) — either wire it into something or explicitly mark it "descriptive only, not authoritative" in a code comment so it doesn't get misread as a gate condition later.
4. Design (not yet implement) the evidence-gate × revision-gate composition (§10.4) as part of Phase 6 planning, not as a Phase 5 concern.
5. Everything else in §8 can wait for Phase 8 as originally planned.

---

## 12. Should Phase 5 be blocked?

**Yes, on item 1 only** (the Export bug) — it's a live data-safety issue independent of any future phase, and every phase from here forward will keep adding more data that Export continues to silently drop, making the eventual fix larger and the interim risk window longer the longer it's left. Items 2-5 do not block Phase 5 specifically (Phase 5 is the fundamentals loader, which doesn't touch completion/export logic at all) but should be resolved before Phase 6, per §11.

---

## Verdict

PHASE_3_REMEDIATION_REQUIRED
