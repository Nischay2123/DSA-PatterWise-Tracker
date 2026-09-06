# Phase 8 Report — Dashboard, weak-area feedback, v2 merge

Scope: the plan's final phase — revision dashboard, `weakConcepts` written from evaluations, merge widened to the v2 namespaces, and the heatmap's "revised" series switched to real revisions.

Branch: `feat/revision-system`. `main` untouched.

---

## 1. Files

**Created**
- `src/revision/dashboard.ts` — `buildTopicRows`, `countDashboard`, `statusDot`, `statusLabel`. Pure, so the counts the UI renders are the counts the tests assert.
- `src/components/revision/Dashboard.tsx` — the `#/revision` route.
- `src/mergeV2.test.ts`, `src/revision/dashboard.test.ts`.

**Modified**
- `src/store.ts` — `mergeStoresV2`, `summarizeMergeV2`, `buildRevisedByDate`, weak-question recording, and (in a follow-up, §6) `isGatingActive` + `MARK_REVISION_SELF_ASSESSED`.
- `src/revision/evaluate.ts` — returns `weakQuestionIds`.
- `src/components/MergeImport.tsx` — merges through the v2 path with a real dry-run diff.
- `src/components/Dashboard.tsx`, `src/components/Heatmap.tsx` — revised series + wording.
- `src/App.tsx` — the `#/revision` route and a header button.
- `src/types.ts`, `src/revision/scheduler.ts` — nullable history score (§6).

---

## 2. Closing the weak-area loop

Phases 4–7 built both halves of this and never connected them. `selection.ts` boosts a candidate by `weakConcepts[problem.id]` — keyed by **question** id — but Phase 7 only ever wrote **concept** ids. The boost could not fire for a question.

`scoreEvaluation` now also returns `weakQuestionIds` (any question scoring under `passScore`), and `applyEvaluation` feeds concepts and questions together into `recordAttemptOutcome`. A cross-module test walks the whole path: a failing evaluation → `weakConcepts` holds both ids → `buildSelectionCandidates` marks that question `isWeak` → `computeQuestionWeight` returns 3×.

---

## 3. Decisions the plan leaves open

**"Strong" and "Weak" are named but never defined.** Pinned to the only hard evidence available: whether the most recent **graded** attempt passed. A topic with no graded history is neither — counting it strong would flatter, weak would be unfair. Self-assessed revisions (§6) are excluded from both, since nothing checked them.

**Merge tie-breaks, written out rather than left to spread order.** `cycle` takes the max; `nextDueAt` comes from whichever side has passed more cycles (equal cycles → the later date, i.e. the side that most recently satisfied a revision), so cycle and due date stay coherent as a pair. `history` unions by `attemptId`. `weakConcepts` takes the **max** per id, never the sum, so merging the same file twice can't inflate a weight. `revisionStats` takes the highest `count` and latest `lastRevisedAt`, with `lastScore`/`lastConfidence` travelling together from the more-revised side.

**An in-progress session is never imported.** `activeSessionId` always stays local — importing one would leave this device "resuming" a session whose attempt it may not even have.

**Settings are never taken from an incoming file.** That would silently swap your provider/model, and an exported `apiKey` is blank by construction anyway.

**The heatmap reads attempts, not `revisionStats.lastRevisedAt`.** That field only remembers the most recent revision per question; walking submitted attempts keeps the whole history on the chart. Counted per question recalled, so the unit still matches the "solved" series. ★ is untouched and still means bookmark (locked decision #16).

---

## 4. A real bug the tests caught

The idempotence test — merge the same file twice, expect no change the second time — failed on first run.

`mergeNotes` only de-duplicated when both sides were *exactly* equal. After one merge a note reads `"mine --- merged --- theirs"`; merging the same file again compares that against `"theirs"`, finds them different, and appends another copy. Notes would grow without bound for anyone who re-merged a backup.

Fixed at the root, in the shared `mergeNotes` (so the v1 path benefits too): split both sides on the separator, union the segments, rejoin. Every pre-existing v1 merge test still passes unchanged.

---

## 5. Tests

92 added (338 → 430 at the time of this phase):

- `mergeV2.test.ts` — completion never regresses; earliest-first/latest-last dates; per-field note union with legacy preserved; approach/pseudocode/code combined; mistakes unioned and de-duplicated; `revisionStats` precedence; orphaned entries kept from both sides; history union; scheduling tie-breaks; `weakConcepts` max; active session never imported; settings never taken; **full-store idempotence**; `summarizeMergeV2` matching the applied result; `buildRevisedByDate` including the "★ dates are not plotted" guard.
- `dashboard.test.ts` — exempt topics omitted; completion/cycle/due-distance derivation; overdue vs due-today; upcoming; mastered; strong/weak by last graded attempt; every status dot and label including "due tomorrow", "next in N days" and "overdue by N days"; and the plan's own acceptance test, *"a failed revision demonstrably over-weights its weak concepts next session"*.

---

## 6. Follow-up in the same phase: gating could lock the user out

Found while answering a pre-deploy question, and fixed before merging (commit `ef28752`).

A topic past 75% gets scheduled, falls due, and blocks new completions in that topic. Clearing it needs a passing score — and only an LLM evaluation produces a score. **With no API key there was no way out.** On real data, several topics would have become permanently un-tickable a week after deploy.

Two escapes, both live-verified:

- `isGatingActive(settings)` — gating is off when the new Settings switch is off, **and off automatically whenever no API key is set**. If nothing can grade a revision, nothing may block on one. An absent setting reads as `true`, so existing stores need no migration.
- `MARK_REVISION_SELF_ASSESSED` — "Mark this revision as done" on the Results screen. Advances the cycle and reschedules like a pass, but stores `score: null` and `selfAssessed: true` rather than inventing a number. The plan forbids fabricating a grade, and a user saying "I did this" is not the same as something having checked it. Both surfaces render *"marked done (not graded)"*.

---

## 7. Live verification

Verified twice: once when the phase was implemented, and again afterwards with a wider scenario. Both passes are recorded because they checked different things.

### Pass 1 — at implementation (3 topics)

1. Counts `0 due today · 2 overdue · 1 upcoming · 2 strong · 1 weak · 0 mastered`, each matching the seeded data.
2. Rows rendered with the right dot, label and Start-revision affordance; a scheduled topic correctly had no Start button.
3. **A gap found and fixed here:** weak *questions* rendered as raw slugs, because only concept ids were being resolved to text. Now a weak question shows its title alongside concept prompts.
4. Merge from a simulated second device: **the applied result matched the dry run exactly** — local pseudocode kept *and* remote insight added, mistake unioned, `revisionStats` taking the richer side, history `["h3","deviceB-1"]`, weak weights **maxed not summed** (`c1` stayed 2), all attempts present, and **`provider` stayed `gemini`** rather than being overwritten by the incoming file's `grok`.
5. **Undo after a v2 merge restored the store byte-for-byte** (`JSON.stringify(after) === JSON.stringify(before)`).
6. Navigation: header *Revision* → `#/revision`; dashboard *Start revision* → the session route.

### Pass 2 — wider scenario (6 topics, every state at once)

Seeded six topics to hit every state simultaneously, then checked the rendered UI against hand-computed expectations.

**Dashboard counts — every tile matched exactly:**

| Tile | Expected | Rendered |
|---|---|---|
| due today | 1 (Recursion) | 1 |
| overdue | 2 (Sorting, Tries) | 2 |
| upcoming | 1 (Greedy) | 1 |
| strong | 3 (Adv Strings, Sorting, Greedy) | 3 |
| weak | 1 (Tries) | 1 |
| mastered | 1 (Adv Strings) | 1 |

Rows rendered as `🔴 Sorting — Overdue by 32 days · last 81/100`, `🟢 Greedy — Next in 74 days`, `🔴 Tries — Revision due (last attempt failed)`, `🟢 Advanced Strings — Mastered`, `⚪ Strings — In progress — 21%`. The exempt `fundamentals` topic is absent, as specified.

**Expanded row** showed `86% complete · 0 passed cycles · next due 2026-08-25`, the failed history entry, and weak areas resolved to a real concept **prompt** (×3) and a real question **title** (×1).

**Heatmap** plotted 2 / 3 / 2 / 3 recalls on Jul 20, Aug 1, Aug 20, Aug 25 — exactly the four seeded sessions — summarised as *"42 solved · 10 revised in sessions on 1 active day"*, with no ★ dates plotted.

**Merge**, through the real file input, from a simulated second device. The confirm dialog reported the true diff:

```
Newly solved: 1 · Newly starred: 1 · Notes combined: 2
Mistakes added: 1 · Revisions added: 1 · Sessions added: 1
Solved after merge: 43 (currently 42)
```

Afterwards the store held the new completion, the star, the merged `keyInsight`, the new mistake, both history entries (`h-tries`, `h-other`) and 5 attempts. **Undo import** was offered after the v2 merge and restored 43 → 42.

**Gating**, all four states: no key → not gated; key + switch on → gated; key + switch off → not gated; "mark done" → un-gated with `cycle 0→1`, `nextDueAt` +14 days and `score: null` persisted.

**One false alarm, chased down rather than reported.** A merge appeared not to update the header (store said 43, header said 42). The cause was my own fixture using an invented question id (`graphs__bfs__number-of-islands`); unknown ids are deliberately stored but never counted against the 467. Re-run with a real id, the header moved 42 → 43 correctly. Same mistake class as the Phase 3 remediation — worth checking before believing a bug.

No application console errors.

---

## 8. Known limitations

- **`summarizeMergeV2`'s "Notes combined" counts entries whose text changed at all**, including a brand-new question arriving with notes. Slightly generous, never wrong in the direction that matters (it can't under-report a loss).
- **Merge is union-only and cannot resolve a genuine conflict.** Two devices editing the same note produce both texts separated by `--- merged ---`. That's the plan's design; a real three-way merge was never in scope.
- **The dashboard lists every non-exempt topic**, including 12 untouched ones. Fine at 18 topics; it would want filtering at a larger scale.
- **`FAILED_PERMANENT` remains unwritten**, as documented in Phase 7.
- **Attempts are never pruned**, so `attempts` grows one entry per session forever. Harmless at personal volumes.

---

## 9. Is Phase 8 complete?

Yes. Dashboard counts match derived state, two devices' exports merge without loss, nothing already solved is ever un-solved, the weak-area loop measurably feeds back into selection, and the heatmap plots real revisions. The gating lockout found at the end was fixed rather than shipped.

With this, phases 0–8 of `DSA_TRACKER_IMPLEMENTATION_PLAN.md` are all complete.

---

## Commit

See `git log` on `feat/revision-system` (`bb53311` for the phase, `ef28752` for the gating fix, and this report alongside).
