# Phase 5 Report — Fundamentals wired in (loader + selection, still no UI)

Scope: exactly the plan's Phase 5 — load `data/fundamentals.json` and select from it. No session UI, no `RevisionAttempt` writes, no gating wiring into `App.tsx`/`context.ts`. Depends on Phase 4 only.

Branch: `feat/revision-system`. `main` untouched. `data/fundamentals.json` not created, modified, or regenerated — read-only per plan §11.

---

## 1. Files created

- `src/revision/session.ts` — the loader, its coverage assertion, and `selectFundamentalsForTopic`.
- `src/revision/session.test.ts`.

Nothing existing was modified, including every Phase 4 file (`config.ts`, `revision/{dates,stateMachine,scheduler,scoring,selection}.ts`) — `session.ts` uses a local copy of Phase 4's five-line seeded PRNG rather than exporting from `selection.ts`, so Phase 4 stays byte-for-byte untouched.

---

## 2. Behavior implemented

**Coverage assertion, fails loudly.** `validateFundamentalsCoverage()` runs once at module import: every pattern id present in `data/questions.json` must have an entry in `data/fundamentals.json`, and no concept id may repeat across the whole file. Either violation throws immediately rather than surfacing later as a silently empty or wrong session — the plan's exact requirement ("a missing pattern must fail the build loudly"). Verified against the real files: 105/105 patterns present, zero duplicate concept ids.

**`getFundamentalsForPattern` / `getPatternIdsForTopic`** — thin, direct lookups; `getPatternIdsForTopic` returns `[]` for an unknown topic id instead of throwing, since an empty result is a normal input for a not-yet-existing session, not a data-integrity violation.

**`selectFundamentalsForTopic(topicId, seed, count)`** — round-robins one concept per pattern per pass (patterns and each pattern's concepts independently seed-shuffled first), so a 4-concept session on a 12-pattern topic like `graphs` draws from up to 4 different patterns instead of clustering on whichever pattern sorts first. Falls back gracefully — returns fewer than `count` without crashing — when a topic has fewer concepts available than requested (e.g. `advanced-strings`, the plan's thinnest topic at 1 pattern). Deterministic for a given seed, matching Phase 4's selection.ts precedent for reproducible/resumable sessions.

**Zero-core-concept pattern.** `fundamentals__logical-thinking` (the one pattern in the real dataset with zero `core` concepts) loads normally through `getFundamentalsForPattern` and, fed through Phase 4's `scoreAttempt` unmodified, produces no `NaN` and no spurious floor failure — confirming the loader and Phase 4's scoring function compose correctly on the one dataset shape the plan specifically calls out as a risk.

---

## 3. Data-model changes

None. No new types, no `AppStoreV2` changes.

---

## 4. Tests added

8 new tests in `session.test.ts` (170 → 178 total), all against the real shipped data files, not synthetic fixtures — per plan §13's own framing that this phase's job is validating the *approved dataset*, not a mock of it:

- Coverage: every real pattern id has a non-empty fundamentals entry; no concept id is duplicated anywhere in the file.
- Selection: returns the requested count spread across more than one pattern on a multi-pattern topic; deterministic for a repeated seed; doesn't crash and returns a partial result on the single-pattern topic; returns `[]` for an unknown topic id.
- Zero-core pattern: `fundamentals__logical-thinking` loads with only `supporting` concepts, and scoring it via the real `scoreAttempt` produces no `NaN` and no floor failure.

---

## 5. Full test / typecheck / build results

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
 ✓ src/revision/dates.test.ts (12 tests)
 ✓ src/revision/scoring.test.ts (12 tests)
 ✓ src/revision/selection.test.ts (14 tests)
 ✓ src/revision/scheduler.test.ts (14 tests)
 ✓ src/persistence/migrate.test.ts (19 tests)
 ✓ src/revision/stateMachine.test.ts (16 tests)
 ✓ src/persistence/db.test.ts (11 tests)
 ✓ src/store.test.ts (72 tests)
 ✓ src/revision/session.test.ts (8 tests)
 Test Files  9 passed (9)
      Tests  178 passed (178)

$ npm run build
✓ 53 modules transformed  (unchanged from Phase 4 -- session.ts is not
  imported by the running app yet, confirming it's still standalone,
  exactly as the plan's dependency graph requires until Phase 6)
✓ built in ~435ms
```

No existing test regressed. Baseline before this phase was 170 tests; Phase 5 added 8.

---

## 6. Live verification

Phase 5 ships zero UI and zero wiring into `App.tsx`/`context.ts` — same situation as Phase 4. Verification was the build's unchanged module count (nothing new pulled into the bundle) plus a fresh reload of the running app confirming no console errors and unchanged behavior. There is no new interactive workflow for a phase whose acceptance criterion is "any topic yields a sensible fundamentals set," verified by the deterministic unit tests above against the real dataset.

---

## 7. Known limitations

- `session.ts` is not reachable from the running app yet — Phase 6 (session UI) is what actually calls `selectFundamentalsForTopic` and writes a `RevisionAttempt`.
- Selection has no notion of "weak concept" boosting yet — `weakConcepts` feeding back into which concepts get selected more often is Phase 8's job, not this phase's. Every concept in a topic's patterns is currently an equal candidate.
- The round-robin spread algorithm is a straightforward reading of "spread across the topic's patterns"; the plan doesn't prescribe a precise algorithm, and this satisfies the stated acceptance criterion without adding weighting the plan doesn't ask for at this phase.

---

## 8. Is Phase 5 genuinely complete?

Yes, against the plan's Phase 5 scope. The loader, the coverage assertion, and pattern-spread selection are implemented and tested against the real `data/fundamentals.json` and `data/questions.json`, including the named zero-core-concept risk case, with no changes to any Phase 4 file and no UI wiring.

---

## Commit

See `git log` on `feat/revision-system` for the exact hash (this file is committed in the same commit it documents).
