# Phase 8 Report — Dashboard, weak-area feedback, v2 merge

Scope: the plan's Phase 8, the final phase — revision dashboard, `weakConcepts` written from evaluations, merge widened to the v2 shape, and the heatmap's "revised" series switched to real revision dates.

Branch: `feat/revision-system`. `main` untouched.

---

## 1. Files

**Created**
- `src/revision/dashboard.ts` — derived rows, the six headline counts, status dot/label. Pure.
- `src/components/revision/Dashboard.tsx` — the `#/revision` route.
- `src/mergeV2.test.ts`, `src/revision/dashboard.test.ts`.

**Modified**
- `src/store.ts` — `mergeStoresV2`, `summarizeMergeV2`, `buildRevisedByDate`, a fixed `mergeNotes`, and weak-question ids fed into `recordAttemptOutcome`.
- `src/revision/evaluate.ts` — `scoreEvaluation` now also returns `weakQuestionIds`.
- `src/components/MergeImport.tsx` — merges through the v2 path, with a six-line diff in the confirm dialog.
- `src/components/Dashboard.tsx`, `src/components/Heatmap.tsx` — real revision dates and matching wording.
- `src/App.tsx` — `#/revision` route and a header button to reach it.

`persistence/backup.ts` was listed in the plan's file list but needed no change: the pre-merge safety net already exists as the complete-v2 undo snapshot added in the Phase 3 remediation, and it is what Undo restores from (verified below). Adding a second, automatic file download on every merge would surprise the user without adding protection.

---

## 2. The weak-area loop, finally closed

This is the one place where earlier phases had built both halves of a mechanism that was never actually connected.

`selection.ts` (Phase 4) boosts a candidate by `weakBoostFactor` when `isWeak` is set. `buildSelectionCandidates` (Phase 6) sets `isWeak` from `weakConcepts[problem.id]` — keyed by **question** id. But Phase 7 only ever wrote **concept** ids into `weakConcepts`. So the boost could never fire for a question; the wire was cut in the middle.

Phase 8 closes it: `scoreEvaluation` now also returns the ids of questions that scored below `passScore`, and `applyEvaluation` passes concepts *and* questions into `recordAttemptOutcome`. The plan's own acceptance test — *"failed revision demonstrably over-weights its weak concepts next session"* — is now testable end to end, and is tested twice: at the weighting level (a flagged question weighs exactly 3× an identical unflagged one) and across modules (a failing evaluation → `weakConcepts` → a candidate that comes back `isWeak: true` with `lastRevisionScore: 40`).

The threshold for "weak question" is `< passScore`, reusing the constant the rest of the system already uses rather than inventing a second bar that could disagree with it.

---

## 3. A real bug the merge tests caught

The idempotence test — *merge the same file twice, the second merge must change nothing* — failed on first run.

`mergeNotes` only de-duplicated when two notes were **exactly** equal. After one merge a note reads `"mine ⏎--- merged ---⏎ theirs"`; merging the same file again compares that whole string against `"theirs"`, finds them different, and appends `"theirs"` a second time. Every re-merge would have grown every conflicting note by another copy, forever.

Fixed at the root, in the shared `mergeNotes` rather than in a v2-only wrapper: a note is now treated as the list of segments it is made of, and merging unions those segments. All pre-existing v1 merge tests still pass unchanged — the v1 path inherits the fix — and two regression tests pin the new behaviour.

This is exactly the class of bug the plan warned about ("merge is the last place data can vanish"); it just corrupts by accretion rather than by loss.

---

## 4. Merge semantics, written down

Every field where two devices can disagree, and the rule that decides it:

| Field | Rule |
|---|---|
| `completed`, `starred` | OR — solved in either copy stays solved. Never un-solves. |
| `firstCompletedAt` | Earliest either side knows. |
| `lastCompletedAt` | Latest either side knows. |
| `starredAt` | Earliest (matches the v1 semantic). |
| `completionGateVersion` | Non-null wins — a gate-verified completion stays verified. |
| `approach` / `pseudocode` / `code` / every note field | Segment union, legacy preserved. Nothing overwritten. |
| `mistakes` | Union, de-duplicated on `at`+`what`+`remember`, date-ordered. |
| `revisionStats` | Highest `count`, latest `lastRevisedAt`; `lastScore`/`lastConfidence` taken together from the side with more revisions, so they stay mutually consistent. |
| `revision.history` | Union by `attemptId`, date-ordered. |
| `revision.weakConcepts` | Per-key **max**, not sum — so re-merging can't inflate a weight. |
| `cycle` / `nextDueAt` / `lastPassedAt` | Taken as one block from the side with more passed cycles; ties break to the later due date. Scheduling fields must agree with each other. |
| `activeSessionId` | Always the local one. An in-progress session belongs to the device that started it. |
| `attempts` | Union by id; local wins a collision. |
| `settings` | **Always local.** Never import another device's provider/model — and an exported `apiKey` is blank by construction anyway. |

An older v1-only export still merges: it's lifted through the existing `migrateV1ToV2` first, so there is one merge path, not two.

---

## 5. Dashboard definitions

The plan names six counts without defining them, so:

- **Due today** — due (or failed-and-due) with no missed date yet. A topic past its threshold but never scheduled counts here, not as overdue.
- **Overdue** — due with `nextDueAt` already in the past.
- **Upcoming** — scheduled for a future date.
- **Mastered** — the state machine's `MASTERED`.
- **Strong / Weak** — decided by whether the most recent **graded** attempt passed. A topic with no graded history is neither: calling it strong would flatter, weak would be unfair.

Exempt topics (`fundamentals`) are filtered out before anything is counted, per §5.

---

## 6. Heatmap: real revisions instead of ★

The "revised" series now counts questions recalled in submitted sessions, sourced by walking `attempts` rather than reading `revisionStats.lastRevisedAt` — that field only remembers the *most recent* revision per question, which would have silently truncated the chart's history.

One subtlety worth flagging: `submittedAt` is a full **UTC** timestamp, while the heatmap grid is built from **local** calendar days (the same convention `completedAt` uses). Slicing the ISO string would have filed an evening session under tomorrow for anyone behind UTC, so the date is converted properly. Wording updated in both the summary line ("revised in sessions") and the per-day tooltip ("revised in a session"). ★ is untouched and still means bookmark everywhere (locked decision #16).

---

## 7. Tests

45 new (293 → **338**), 15 files:

- `mergeV2.test.ts` (27) — completion never regresses (5) · no written work lost, incl. per-field note union, mistake de-dup, revisionStats, orphans (5) · revision namespace: history union, scheduling block, weak-concept max, never importing an active session (5) · attempts and settings (3) · **idempotence** (1) · dry-run/applied agreement (2) · heatmap revised series (4) · `mergeNotes` regression (2).
- `revision/dashboard.test.ts` (16) — row derivation, exempt filtering, overdue arithmetic, all six counts, dot/label wording, and the weak-boost proof.
- `store.test.ts` (+2) — the cross-module weak-area loop, and its negative case.

---

## 8. Full results

```
$ npx tsc --noEmit    (clean)
$ npx vitest run      15 files, 338 passed (338)
$ npm run build       ✓ 75 modules transformed, built in ~430ms
```

No existing test regressed — including every v1 merge test, which now also covers the `mergeNotes` fix.

---

## 9. Live verification

Seeded three topics into distinct states (overdue, comfortably scheduled, failed-and-due) plus two real submitted sessions.

1. **Dashboard counts** — `0 due today · 2 overdue · 1 upcoming · 2 strong · 1 weak · 0 mastered`, each matching the seeded data.
2. **Rows** — `🔴 Advanced Strings — Overdue by 32 days · last 88/100 · [Start revision]`, `🟢 Sorting — Next in 48 days · last 91/100` (no Start button; not gated), `🔴 Tries — Revision due (last attempt failed)`.
3. **Expansion** — Tries shows `86% complete · 0 passed cycles · next due 2026-08-25`, its history entry, and weak areas resolved to readable text.
4. **A gap found and fixed here:** weak *questions* (new in this phase) rendered as raw slugs, because only concept ids were being resolved to prompts. Now shows `Trie Implementation and Advanced Operations ×1` alongside the concept prompt.
5. **Heatmap** — cells read `2 revised in a session on Jul 18, 2026` and `1 revised in a session on Aug 25, 2026`; summary reads `20 solved · 3 revised in sessions on 1 active day`.
6. **Merge, through the real UI** — a simulated second device (overlapping question with different notes, a new solved question, its own history/attempt, and `provider: grok`). Dialog: `Newly solved 1 · Newly starred 1 · Notes combined 2 · Mistakes added 1 · Revisions added 1 · Sessions added 1 · Solved after merge: 21 (currently 20)`.
7. **Applied result matched the dry run exactly** — 21 solved; local pseudocode kept *and* remote insight added; mistake unioned; `revisionStats` took the richer side; tries history `["h3","deviceB-1"]`; weak weights maxed not summed (`c1` stayed 2, not 1); all three attempts present; **provider stayed `gemini`**, not `grok`; nothing from before the merge missing.
8. **Undo after a v2 merge** — restored the store **byte-for-byte identical** to the pre-merge snapshot (`JSON.stringify(after) === JSON.stringify(before)`).
9. **Navigation** — header *Revision* → `#/revision`; dashboard *Start revision* → `#/revision/tries`.
10. **Console** — clean on a fresh reload.

---

## 10. Known limitations

- Merging a file from a device whose clock is wrong will let that side's "later" dates win. There is no clock-skew detection; for a personal two-device setup this is an acceptable trade, and Undo is one click away.
- Notes that genuinely conflict are kept side by side, not resolved. That's the plan's intent (never drop text), but a heavily re-merged note can get long. The segment union at least guarantees it stops growing once both sides are represented.
- The dashboard lists all 17 non-exempt topics, unsorted and unfiltered. Fine at this size; if it ever felt long, sorting due-first would be the obvious next step.
- `attempts` still accumulate without pruning, and merging unions them, so two active devices grow that set faster. Nothing reads it in bulk, so it costs storage only.

---

## 11. Is Phase 8 complete?

Yes, against the plan's Phase 8 scope, and with it the plan's phase list is finished. Every Phase 8 test bullet is covered: existing merge tests still pass, the v2 namespaces merge without loss, mistakes/attempts/history union, the dry-run diff matches the applied result, a failed revision demonstrably over-weights its weak concepts next session, and Undo import still restores after a v2 merge.

The one outstanding item across the whole project remains the Phase 7 real-key round trip (PHASE_7_REPORT.md §8), which needs a credential and is yours to run.

---

## Commit

See `git log` on `feat/revision-system` (this file is committed alongside the code it documents).
