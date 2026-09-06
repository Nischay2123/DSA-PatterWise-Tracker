# Phase 4 Report — Revision engine (headless, no UI, no LLM)

Scope: exactly the plan's Phase 4 — `config.ts` and `revision/{stateMachine,scheduler,selection,scoring}.ts` as pure, tested functions. No UI, no wiring into `context.ts`/`App.tsx`/`StoreContext`, no fundamentals loading, no LLM. Depends on Phase 2 only (the `TopicRevision`/`RevisionAttempt` schema), not Phase 3.

Branch: `feat/revision-system`. `main` untouched.

---

## 1. Files created

- `src/config.ts` — `REVISION_CONFIG`, verbatim from plan §5.
- `src/revision/dates.ts` — UTC-safe day arithmetic (`addDaysUTC`, `daysBetweenUTC`, `todayISOUTC`). Deliberately separate from `store.ts`'s heatmap dates, which use local-calendar days on purpose; the scheduler specifically needs to be DST-proof, which local-timezone `Date` mutation is not.
- `src/revision/stateMachine.ts` — `deriveState`, `isTopicGated`.
- `src/revision/scheduler.ts` — `scheduleInitial`, `recordAttemptOutcome`, `incrementWeakConcepts`.
- `src/revision/scoring.ts` — `computeOverallScore`, `scoreAttempt`.
- `src/revision/selection.ts` — `computeQuestionWeight`, `selectQuestionsForSession`.
- Five matching `.test.ts` files.

Nothing existing was modified. `types.ts`'s `TopicRevision`/`RevisionAttempt` (from Phase 2) needed no changes — verified sufficient before writing any code.

---

## 2. Behavior implemented

**State machine.** `deriveState(topicRevision, completionPct, isExempt, now)` covers all seven states from plan §6. The plan's table doesn't specify precedence when multiple conditions hold simultaneously, so this was made explicit and tested exhaustively:

```
REVISION_IN_PROGRESS > MASTERED > REVISION_FAILED > REVISION_DUE
> REVISION_SCHEDULED > IN_PROGRESS > NOT_STARTED
```

An active session always wins (the user is mid-flow, not merely "due"). Mastery is checked next as the terminal achievement — it wins even over a due-and-failed history. A due topic whose last attempt failed reports `REVISION_FAILED` rather than a generic `REVISION_DUE`. `isExempt` (for `REVISION_CONFIG.exemptTopics`) forces `NOT_STARTED`/`IN_PROGRESS` regardless of every other field, implementing "exempt topics are permanently NOT_STARTED/IN_PROGRESS" directly rather than relying on every future caller to remember the special case. `isTopicGated` implements the exact gating scope from §6: only `REVISION_DUE` and `REVISION_FAILED` block anything.

**Scheduler.** `scheduleInitial` fires once, the moment completion first crosses the threshold, using `intervalDays[0]` = 7 days (cycle is 0 at that point — this is the "schedule created" step from the plan's §5 diagram, distinct from a pass). `recordAttemptOutcome` implements the interval advance exactly: a pass increments `cycle` and re-schedules at `intervalDays[min(newCycle, len-1)]`, verified to produce the full 7 → 14 → 30 → 60 → 90 → 90 (clamped) sequence; a fail leaves `cycle`/`nextDueAt` completely untouched. Both outcomes clear `activeSessionId` (the session concluded either way) and append to `history`.

**Scoring.** The critical-concept floor is `every(coreConcepts, c => c.score >= floor)`, never an average — verified against the real `data/fundamentals.json`: `fundamentals__logical-thinking` is confirmed to be the one pattern with zero `core` concepts (all 5 of its concepts are `supporting`), and the floor check correctly returns vacuously `true` for it rather than `NaN >= floor` silently failing every revision that touches it.

**Selection.** `computeQuestionWeight` implements the exact multiplicative formula from plan §8. `selectQuestionsForSession` does weighted selection without replacement, using a seeded deterministic PRNG (mulberry32) so sessions are reproducible/resumable and tests are deterministic; it prefers a candidate from a pattern not yet used in the session, falling back to the full pool once every pattern has contributed. Returns everything available (no crash, no padding) when fewer candidates exist than requested.

---

## 3. Two assumptions made explicit (the plan doesn't fully specify these)

1. **Overall score aggregation.** The plan specifies the LLM's per-fundamental/per-question response shape and `passScore: 70`, but never the exact formula for collapsing many 0-5 sub-scores into one 0-100 total. Implemented as: every individual sub-score (each fundamental's score, plus each question's correctness/approach/pseudocode/complexity) weighted equally, averaged, and scaled ×20. This is the simplest formula consistent with "the model's own `passed` is advisory... the client computes it." Phase 7, once a real LLM response exists to validate against, may need to revisit this weighting.
2. **"Weak concept" threshold.** The plan defines `weakConcepts` as something selection reads but doesn't say what makes a concept "weak" from a scoring result. Implemented by reusing `criticalConceptFloor` as the same cutoff (any concept — core or supporting — scoring below it is reported as weak), since no separate threshold is specified and reusing the existing constant keeps the two ideas consistent.

Both are documented in code comments at the point of decision, not just here.

---

## 4. Data-model changes

None. Phase 2's `TopicRevision`/`RevisionAttempt` types were sufficient as-is.

---

## 5. Tests added

68 new tests across 5 new files (92 → 160 total):

- `dates.test.ts` (12): whole-day arithmetic, month/year rollover, explicit DST spring-forward and fall-back boundary checks, UTC-vs-local-midnight distinction.
- `stateMachine.test.ts` (16): every one of the 7 states reached in isolation, the 74.9%/75.0% threshold boundary, every precedence override (in-progress-beats-failed, mastered-beats-due-and-failed), exempt-topic override, and the gating predicate across all 7 states.
- `scheduler.test.ts` (14): the initial 7-day schedule (including across a DST boundary), the full 7/14/30/60/90 pass sequence through cycle 10 (clamped), fail leaving cycle/nextDueAt untouched, session-clearing on both outcomes, weak-concept incrementing.
- `scoring.test.ts` (12): pass at exactly 70, fail at 69, pass-by-total-but-blocked-by-the-floor, **the zero-core-concept case verified non-NaN and not spuriously blocked**, weak-concept collection.
- `selection.test.ts` (14): every weighting factor in isolation and composed multiplicatively, no duplicates, correct behavior with fewer candidates than requested, pattern-spread, and the 1000-seeded-run weak-over-representation check (empirically measured at 59.2% inclusion vs. a ~30% naive baseline for a 3-of-10 selection — comfortably clear of the 45% test threshold, not a flaky margin).

---

## 6. Full test / typecheck / build results

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
 ✓ src/revision/dates.test.ts (12 tests)
 ✓ src/revision/selection.test.ts (14 tests)
 ✓ src/revision/stateMachine.test.ts (16 tests)
 ✓ src/revision/scoring.test.ts (12 tests)
 ✓ src/revision/scheduler.test.ts (14 tests)
 ✓ src/persistence/migrate.test.ts (19 tests)
 ✓ src/store.test.ts (62 tests)
 ✓ src/persistence/db.test.ts (11 tests)
 Test Files  8 passed (8)
      Tests  160 passed (160)

$ npm run build
✓ 53 modules transformed  (same module count as before Phase 4 -- revision/
  and config.ts are not imported by anything yet, confirming they're fully
  standalone as the plan requires)
✓ built in ~400ms
```

No existing test regressed. Baseline before this phase was 92 tests; Phase 4 added 68.

---

## 7. Live verification

Phase 4 ships zero UI and zero wiring into the running app (`App.tsx`, `context.ts`, and every component are untouched), so there is no new user-facing workflow to click through. Verification here was: confirming the production build's module count is unchanged (proving nothing new got pulled into the bundle) and loading the app fresh in the browser to confirm zero console errors and unchanged behavior — both passed. Deep interactive browser testing (the kind done for Phases 2/3) isn't meaningful for a phase whose entire acceptance criterion is "tested pure functions," per the plan's own "Depends on Phase 2 (not 3)" framing.

---

## 8. Known limitations

- Nothing in `revision/` is reachable from the app yet — that's Phase 6 (session UI) and Phase 5 (fundamentals loader) to wire up.
- `scoring.ts` operates on already-extracted `FundamentalScore[]`/`QuestionScore[]` arrays; it has no knowledge of the real LLM response schema's exact field names (`perFundamental`/`perQuestion` per §9&10) since that mapping is Phase 7's job once the LLM client exists.
- The two documented assumptions (§3) are genuine gaps in the plan, not settled design — worth confirming with real LLM output once Phase 7 exists, in case the intended weighting differs.
- `selection.ts`'s pattern-spread logic is a simple "prefer unused, else fall back to full pool" rule; the plan says "prefer spreading" without a precise algorithm, and this satisfies it without over-specifying behavior the plan didn't ask for.

---

## 9. Is Phase 4 genuinely complete?

Yes, against the plan's Phase 4 scope. Every acceptance criterion and every §13 test bullet for Scheduler/State machine/Scoring/Selection is implemented and passing, including the specific zero-core-concept guard the plan calls out by name and verifies against the real `fundamentals.json`.

---

## Commit

See `git log` on `feat/revision-system` for the exact hash (this file is committed in the same commit it documents, so the hash can't be self-referential without an amend).
