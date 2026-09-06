# Phase 6 Report — Revision session UI (local self-assessment, still no LLM)

Scope: exactly the plan's Phase 6 — full session flow (fundamentals → question recall → confidence → submit → results), resumable, gating banner + disabled checkboxes on the tracker. No LLM, no Settings panel, no API key handling, no Phase 8 dashboard — those stay untouched.

Branch: `feat/revision-system`. `main` untouched. No Phase 4 file modified. Phase 5's `revision/session.ts` extended, per the plan's own Phase 6 file list.

---

## 1. Files created

- `src/useHash.ts` — hash-routing hook, no router dependency (plan decision #2).
- `src/components/revision/SessionShell.tsx` — session container: finds/creates the topic's attempt, derives which step to show, renders Results once submitted.
- `src/components/revision/FundamentalsStep.tsx`, `RecallStep.tsx`, `ConfidenceStep.tsx`, `ResultsStep.tsx` — the four steps.

## 2. Files modified

- `src/types.ts` — `RevisionAttempt.questions[].confidence` widened to allow `null` (an unrated draft state — mirrors `SelectionCandidate.lastConfidence`'s existing null-means-unset idiom). Five new `V2Action` variants: `START_REVISION_SESSION`, `SAVE_FUNDAMENTAL_ANSWER`, `SAVE_QUESTION_RECALL`, `SAVE_QUESTION_CONFIDENCE`, `SUBMIT_REVISION_SESSION`.
- `src/store.ts` — `getTopicRevision` (default-when-missing helper, mirrors `getV2Progress`), `ensureTopicsScheduled` (plan §5's "schedule created" step, fired automatically), and the five reducer cases for the actions above.
- `src/revision/session.ts` (Phase 5 file, extended per plan) — `buildSelectionCandidates` (real `SelectionCandidate[]` from live progress, feeding Phase 4's `selectQuestionsForSession` unmodified), `createRevisionAttempt` (assembles a full draft attempt in one shot), `getConceptById`, `mostRecentAttemptForTopic`.
- `src/context.ts` — the existing `[store]` sync effect now also runs `ensureTopicsScheduled` after `patchV2FromV1`.
- `src/App.tsx` — hash-routes `#/revision/:topicId` to `SessionShell`, everything else to the existing tracker.
- `src/components/TopicList.tsx` — computes `deriveState`/`isTopicGated` per topic, renders the due-banner with a "Start revision" link.
- `src/components/PatternGroup.tsx`, `QuestionRow.tsx` — thread `gated` down; the checkbox is `disabled` (with an explanatory `title`) only when gated **and** the question isn't already done, matching the plan's exact gating scope.

---

## 3. Design decisions the plan leaves open, made explicit

**"Self-assessment-only score" has no computed score at all.** Plan §8 is explicit that confidence is "learning data, never a score." Without an LLM (Phase 7), there is no legitimate way to compute a 0–100 score or a pass/fail — doing so from confidence alone would be exactly the kind of fabricated grading the plan's LLM section works hard to avoid. So Phase 6 computes nothing: `ResultsStep` shows the user's own answers next to the real `expectedConcepts` (for self-judging) and next to their own previously-stored solution (the "reveal" the plan describes at §12, which isn't actually LLM-dependent), plus a plain tally of self-rated confidence. `TopicRevision.cycle/history/nextDueAt` are **not** touched by submission — there is nothing to legitimately advance them with yet, so the topic stays exactly as gated as it was, which matches §9's own already-specified behavior for a no-key evaluation ("topic stays gated — not passed, not failed").

**`evaluationStatus` transitions to `PENDING` on submit, not a new status.** This reuses the exact state Phase 7 already defines for "saved, evaluation not yet run" rather than inventing a Phase-6-only status — once Phase 7 exists, it can scan `PENDING` attempts and evaluate the backlog with no Phase 6 code changes.

**Submission does write `revisionStats` (`count`, `lastRevisedAt`, `lastConfidence`) per question.** These represent real facts independent of grading — a recall attempt genuinely happened — and Phase 4's `selection.ts` already reads exactly these fields for future weighting. `lastScore` is left untouched (`null` until Phase 7), never fabricated.

**Automatic scheduling on first threshold-crossing.** The plan's diagram has an explicit "schedule created" step between crossing 75% and becoming due — without it, every topic already above 75% would become instantly `REVISION_DUE` the moment this phase ships, which is a jarring, undocumented behavior change for existing data. `ensureTopicsScheduled` fires this exactly once per topic (skipped forever once any revision entry exists, so it can never re-trigger or clobber real history).

---

## 4. A real bug found and fixed during live verification

Manual browser testing surfaced a genuine bug, not caught by unit tests because it only manifests with real React mount timing:

**Symptom.** Completing and submitting a session immediately started a brand-new session instead of showing the just-submitted results.

**Root cause.** `main.tsx` wraps the app in `<StrictMode>`, which double-invokes a mount effect with no intervening render. `SessionShell`'s attempt-creation effect had no guard against this, so both invocations saw "no attempt yet" and each dispatched `START_REVISION_SESSION` — creating two attempts with the **same millisecond `startedAt`**, one silently orphaned. `SUBMIT_REVISION_SESSION` correctly marked the real (second) one submitted, but `mostRecentAttemptForTopic`'s tie-break (`>`) favored the first-inserted, forever-unsubmitted orphan on an exact timestamp tie — so the UI kept resurfacing the wrong attempt and, since it looked like "no attempt", the effect fired again, creating session after session.

**Fix, two parts:**
1. `SessionShell` now guards the effect with a `topic.id`-keyed ref, so the dispatch fires at most once per topic regardless of StrictMode's double-invoke (same class of protection `persistence/db.ts` already has for the initial boot load's `inFlight` guard).
2. `mostRecentAttemptForTopic`'s tie-break changed to `>=`, so an exact-tie case (still possible in principle) resolves to the later-inserted attempt rather than an arbitrary orphan.

Verified live: after the fix, exactly one attempt is created per session start (confirmed by direct inspection of the persisted IndexedDB record), and submitting correctly lands on `ResultsStep` — including after a full page reload, not just within the same render.

Two new tests lock this in: `mostRecentAttemptForTopic`'s tie-break test, and the existing "picks the latest, submitted or not" test.

---

## 5. Tests added

31 new tests (178 → 209):

- `store.test.ts` (+19): `getTopicRevision` default/real; `ensureTopicsScheduled` — schedules at threshold, doesn't schedule below it, never schedules an exempt topic, never overwrites an existing entry, no-op (same reference) when nothing changes; all five new `v2Reducer` cases including the no-op-for-unknown-attempt-id guards, `revisionStats` incrementing (not resetting) on repeated submissions, and skipping an unrated question rather than crashing.
- `session.test.ts` (+12): `getConceptById`; `buildSelectionCandidates` against real data (only completed questions included, real mistakes/revisionStats/weakConcepts carried through, empty/unknown-topic cases); `createRevisionAttempt` (shape, zero-completed-questions doesn't crash, deterministic for a fixed `now`); `mostRecentAttemptForTopic` (empty, topic-scoped, latest-wins, and the tie-break fix above).

---

## 6. Full test / typecheck / build results

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
 ✓ src/revision/dates.test.ts (12 tests)
 ✓ src/revision/stateMachine.test.ts (16 tests)
 ✓ src/revision/scoring.test.ts (12 tests)
 ✓ src/revision/selection.test.ts (14 tests)
 ✓ src/revision/scheduler.test.ts (14 tests)
 ✓ src/persistence/migrate.test.ts (19 tests)
 ✓ src/persistence/db.test.ts (11 tests)
 ✓ src/store.test.ts (90 tests)
 ✓ src/revision/session.test.ts (21 tests)
 Test Files  9 passed (9)
      Tests  209 passed (209)

$ npm run build
✓ 66 modules transformed (53 -> 66: revision/, config.ts, and the new
  session components are finally reachable from the running app)
✓ built in ~415ms
```

No existing test regressed. Baseline before this phase was 178 tests; Phase 6 added 31.

---

## 7. Live verification (real browser, real IndexedDB inspected)

Performed end-to-end against the real dataset on `advanced-strings` (its thinnest topic — 6 problems, 1 pattern):

1. **Threshold-crossing schedule.** Imported a real v2 export with 5/6 problems completed. Confirmed via direct IndexedDB inspection that `ensureTopicsScheduled` fired exactly once, setting `nextDueAt` to today+7 — the topic showed `REVISION_SCHEDULED` (no banner, checkbox enabled), not instantly due.
2. **Gating.** Rewrote `nextDueAt` to the past directly in IndexedDB and reloaded: the due-banner ("Revision due for Advanced Strings — Start revision") appeared, and the one not-yet-completed question's checkbox was confirmed `disabled` with the correct explanatory `title` via direct DOM inspection. Starring that same (uncompleted, gated) question worked instantly, unblocked — confirming gating's exact scope (only new completions are blocked).
3. **Full session, real UI interaction.** Clicked "Start revision", answered all 4 real fundamentals prompts pulled from `data/fundamentals.json`, answered recall (approach/pseudocode/complexity) for the 3 selected real problems, rated confidence per question (one of each: strong/partial/forgot), submitted.
4. **Refresh mid-session resumes exactly.** Filled one fundamentals answer, reloaded the page fully — the answer survived and the session correctly resumed on the same step, with only one attempt in the persisted store (not a duplicate).
5. **Results correctness.** After submit, landed directly on `ResultsStep`: confidence tally read "1 strong · 1 partial · 1 forgot" (exact match to what was clicked); each fundamental showed the real answer beside the real `expectedConcepts`; each question showed "Your recall" beside "Your stored solution" pulled from real `progress` data.
6. **Post-submission revisit.** Reloaded the page again after submission (simulating "browser closed mid-session" / later revisit) — correctly showed the same Results again, not a new session.
7. **Topic stays gated after submission.** Confirmed the due-banner and disabled checkbox were still present after submitting — correct, since no evaluation exists yet to legitimately un-gate it.
8. **Weighted selection is live.** A second session on the same topic selected a different set of 3 questions than the first, consistent with `selection.ts`'s weighting now having real `lastConfidence`/`lastRevisedAt` data to read.
9. **No console errors** on a fresh reload of the tracker after all of the above.

---

## 8. Known limitations (all expected at this phase boundary, not gaps)

- The topic remains gated indefinitely until Phase 7 ships real evaluation — there is currently no way to un-gate `advanced-strings` in this test data short of directly editing `TopicRevision`. This is the plan's own specified behavior for an unevaluated `PENDING` attempt, not a Phase 6 defect.
- No "Retry" affordance exists yet (Phase 7 introduces it) — clicking "Start revision" again after a submitted-but-unevaluated attempt would create a fresh session rather than retrying evaluation of the old one, since there is nothing to retry yet.
- The `#/revision` dashboard route (listing all topics' revision state) is Phase 8's `Dashboard.tsx`, not Phase 6's — the only entry point into a session right now is the gating banner's "Start revision" link.
- `Object.values(v2.attempts)` scans grow unbounded over time (no pruning of old attempts) — acceptable for a personal tool's data volumes; not a Phase 6 concern.

---

## 9. Is Phase 6 genuinely complete?

Yes, against the plan's Phase 6 scope. Session start/resume/submit/results all work end-to-end with no network calls, gating is wired into the real tracker UI with the exact scope the plan specifies, and a real StrictMode-triggered data-integrity bug was found and fixed during verification rather than papered over.

---

## Commit

See `git log` on `feat/revision-system` for the exact hash (this file is committed in the same commit it documents).
