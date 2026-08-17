# Rebaseline Audit — DSA Tracker

**Purpose.** The local repository used to author `DSA_TRACKER_IMPLEMENTATION_PLAN.md` and to implement Phase 0 / Phase 1 / Phase 1B was behind the deployed remote. This audit establishes the deployed application as the authoritative baseline and reports exactly what that invalidates.

**Status.** Audit only. No application code was modified while producing this document.

**Correction to the brief:** the gap is **9 commits**, not 8 — 7 substantive commits plus 2 merge commits. Verified with `git rev-list --count` (total 9, non-merge 7, merges 2).

---

## 1. Current deployed baseline

| | |
|---|---|
| Commit | `ea95806` — *Merge pull request #2 from Nischay2123/claude/activity-heatmap-timeframe-88ym1p* |
| Ref | `origin/main` (also `origin/HEAD`) |
| Date | 2026-07-31 |
| Files | `index.html` (105 lines), `app.js` (718 lines), `styles.css` (455 lines), `data.js`, `README.md` |
| Stack | Still plain HTML/CSS/JS. No build step, no dependencies, no backend. |

A second remote branch exists — `origin/claude/activity-heatmap-timeframe-88ym1p` at `a4653b7` — which is simply the pre-merge tip of PR #2 and is already contained in `origin/main`. Nothing is stranded there.

## 2. Original local baseline

| | |
|---|---|
| Commit | `f471396` — *Add README* |
| Date | pre-existing local `main` |
| Files | `index.html` (64), `app.js` (260), `styles.css` (216), `data.js`, `README.md` |

This is the state described in `DSA_TRACKER_IMPLEMENTATION_PLAN.md` §1. It was **9 commits stale** at the moment the plan was written.

### Git-state note (needs cleanup before any commit)

To read the real baseline I ran `git reset --soft origin/main`. That moved local `main` to `ea95806` but **left the index holding the stale tree**. Right now:

- `git diff --cached --stat` vs `HEAD` shows **804 deletions** across `app.js` / `index.html` / `styles.css`
- staged `app.js` = 260 lines; deployed `app.js` = 718 lines

**Committing the index as-is would delete the entire deployed heatmap implementation.** Nothing is lost — `ea95806` is intact in git and on the remote — but the index must be reset (`git restore --staged .`) before any commit. No commit has been made. `git reflog` retains the prior position `f471396`.

---

## 3 & 4. The commits, and what each changed

All 9 commits touch **only** `app.js`, `index.html`, `styles.css`. Verified: `git diff --name-only f471396 origin/main` returns exactly those three files.

| # | Commit | Summary |
|---|---|---|
| 1 | `ed5d1e3` | Add GitHub-style activity heatmap with 1M/3M/6M/1Y range toggle |
| 2 | `2cc1f91` | Replace range buttons with year navigation, restyle heatmap cells |
| 3 | `a948d0e` | Visually separate months in the heatmap grid, LeetCode-style |
| 4 | `0fcb461` | Place heatmap days precisely within their own month block |
| 5 | `d66b313` | *(merge)* PR #1 |
| 6 | `c3132d3` | Unify heatmap and analytics into a single aligned stats card |
| 7 | `0e80e86` | Fix data-loss on import, retrievable revision list, touch tooltips, a11y |
| 8 | `a4653b7` | Add merge import, tucked into an Advanced footer section |
| 9 | `ea95806` | *(merge)* PR #2 |

### `ed5d1e3` — activity heatmap *(the schema-changing commit)*
- **Data/schema:** introduces `completedAt` and `revisedAt` (ISO `YYYY-MM-DD`) on every problem state. `getState` default becomes `{done, revise, notes, completedAt: null, revisedAt: null}`.
- **Persistence:** ticking done writes `completedAt: todayISO()` / clears to `null`; starring writes `revisedAt` the same way. **No backfill and no `version` bump** — see §9.
- **UI:** dashboard card, heatmap grid, legend, summary line, range toggle.
- **IDs / question data / import-export format / APIs:** unchanged.

### `2cc1f91` — year navigation
- Replaces the 1M/3M/6M/1Y toggle with ‹ / year-label / › navigation; adds `earliestYearOffset` so paging stops at the earliest record. UI + logic only.

### `a948d0e`, `0fcb461` — heatmap grid layout
- Month-block rendering so a week straddling a month boundary is split and no day renders under a neighbouring month's label. Pure rendering/CSS. No data, no persistence.

### `c3132d3` — unify heatmap + analytics
- Analytics moves *inside* the dashboard card as a nested `<details class="dash-analytics">`. **Analytics becomes closed-by-default** (the `open` attribute is dropped). Layout only.

### `0e80e86` — data-loss fix, a11y, touch *(largest commit: 449 insertions)*
- **Persistence:** new second localStorage key `dsa-tracker-progress-backup` (`BACKUP_KEY`); import now takes a one-time backup and offers **Undo import**. `saveStore` wrapped in try/catch with a one-time alert on quota/private-mode failure.
- **Import/export:** `isValidStore` validation, a confirm dialog showing solved-count before/after, and a **date-stamped export filename** (`dsa-tracker-progress-<date>.json`).
- **UI/behaviour:** "★ Revision only" filter; filters collapse into a disclosure under 700px; no-results message with a clear-filters action; topic-level mini progress meter; notes-button indicator dot for problems that have notes; `Continue →` jump-to-next-unsolved with a highlight flash; heatmap tooltips reworked for mouse + keyboard + touch; search haystack widened to include topic / pattern / subpattern / platform; accordion open-state saved before filtering and restored when filters clear.
- **A11y:** `:focus-visible` outlines, `aria-label` / `aria-pressed`, coarse-pointer touch targets, 16px inputs to stop iOS zoom, `prefers-reduced-motion` handling, WCAG-AA badge colours.

### `a4653b7` — merge import
- **Persistence:** `mergeStores` union merge (solved-in-either wins, earliest date wins, differing notes concatenated, never un-solves), `summarizeMerge` preview, backup taken before applying.
- **UI:** "Advanced" footer disclosure, deliberately far from the header's destructive Import button.

### Cross-cutting answers to the audit checklist

| Question | Answer |
|---|---|
| Question / pattern / topic data changed? | **No.** `data.js` is byte-identical between `f471396` and `origin/main`. |
| Problem IDs changed? | **No.** Still positional `p1`…`p467`, 467 problems, 105 patterns, 18 topics. |
| Pattern / topic IDs changed? | **No.** |
| localStorage affected? | **Yes.** Two new fields + one new key. |
| Notes / stars / completion affected? | Notes and completion semantics unchanged; **stars now also write `revisedAt`**. |
| Import/export affected? | **Yes.** Validation, backup+undo, merge, date-stamped filename. Payload shape is the same object, now carrying two extra fields. |
| APIs / external integrations? | **None.** Still zero network calls. |
| Affects the future revision system? | **Yes** — see §14, `revisedAt` semantics. |
| Affects the planned LLM integration? | **No.** |

---

## 5. Impact on `DSA_TRACKER_IMPLEMENTATION_PLAN.md`

| Plan section | Assumption | Verdict |
|---|---|---|
| §1 file table (64/260/216 lines) | Stale line counts | **PLAN UPDATE REQUIRED** |
| §1 "Persistence: `{done, revise, notes}`" | Missing `completedAt`/`revisedAt` and the backup key | **PLAN UPDATE REQUIRED** |
| §1 "Corrections to the brief → *Question dates / history: **None.** No timestamp is written anywhere*" | **Factually wrong against deployed.** Dates exist and drive a whole feature. This was the plan's own headline correction to your brief, and it is the single most wrong statement in the document. | **PLAN UPDATE REQUIRED** |
| §1 feature inventory ("the preservation contract") | Omits heatmap, streak, stat tiles, Continue, revise-only filter, filter disclosure, no-results, topic meter, notes dot, merge, undo-import, a11y set | **PLAN UPDATE REQUIRED** |
| §1 ID verification tables | Ran against `data.js` which is identical in both baselines | **NO IMPACT** — re-validated in §6 |
| §2 target architecture (React 19 / TS / Vite / Tailwind v4 / hash routing / Context) | Untouched by these commits | **NO IMPACT** |
| §3 "no database" | Untouched | **NO IMPACT** |
| §4 migration step 5: `firstCompletedAt: null, lastCompletedAt: null` — *"unknowable — honestly null, never faked"* | Now wrong for every problem completed after `ed5d1e3` shipped. Real dates exist and must be carried across, not nulled. | **PLAN UPDATE REQUIRED** + **DATA MIGRATION RISK** |
| §4 backup step | Accounts only for `dsa-tracker-progress`; `dsa-tracker-progress-backup` is unaccounted for | **PLAN UPDATE REQUIRED** |
| §5–§6 revision engine / state machine | Design unaffected, but collides semantically with `revisedAt` | **REQUIRES USER DECISION** |
| §7 notes → "🟢/⚪ indicator" | A notes indicator already ships upstream | **PLAN UPDATE REQUIRED** (port, don't invent) |
| §8 fundamentals | Keys on pattern ids; `data.js` unchanged | **NO IMPACT** — re-validated in §6 |
| §9–§10 LLM / BYO key | Untouched | **NO IMPACT** |
| §11 `QuestionProgress` model | Needs `completedAt`/`revisedAt` as migration *sources* | **PLAN UPDATE REQUIRED** |
| §12 "Tracker — visually unchanged" | Must now include the whole dashboard | **PLAN UPDATE REQUIRED** |
| §13 manual smoke checklist | Doesn't exercise any deployed feature added in these 9 commits | **PLAN UPDATE REQUIRED** |
| §14 rollback ("`main` deploy is the rollback") | Still true, and now more important | **NO IMPACT** |
| Phase 1 scope & acceptance | Parity measured against the wrong inventory | **PHASE 1 INVALIDATED** |
| Phase 8 "export/import merge" | Merge already exists upstream and is better specified than the plan's sketch | **PLAN UPDATE REQUIRED** (reduce to a port) |

---

## 6. Impact on Phase 0 — **fully valid, nothing to redo**

Re-validated against the **deployed** dataset, not the stale one:

| Check | Result |
|---|---|
| Deployed `data.js` | 18 topics / 105 patterns / 467 problems |
| Deployed problem ids still positional `p\d+` | **true** (the defect Phase 0 fixes is still present upstream) |
| `data/idMap.json` covers every deployed problem id | **true** |
| `idMap` targets == `data/questions.json` problem ids | **true** |
| `data/questions.json` patterns == deployed pattern ids | **true** |
| `data/questions.json` problem count | **467** = deployed 467 |
| `data/fundamentals.json` keys == deployed pattern ids | **true** |

**Verdict: NO IMPACT.** Because `data.js` is byte-identical across the 9 commits, every Phase 0 artifact — `idMap.json`, `idRegistry.json`, `questions.json` — and the frozen `fundamentals.json` remain correct against the authoritative baseline. `fundamentals.json` must **not** be regenerated.

---

## 7. Impact on Phase 1 / 1B — **invalidated as "parity", salvageable as "foundation"**

Phase 1's stated acceptance criterion was parity with the §1 feature inventory. That inventory was derived from stale code, so Phase 1 was verified against the wrong target and shipped without ~12 deployed features.

**Important disclosure about current working-tree state.** In the turn immediately before this audit was requested, I had already begun porting the missing features into the React app. The working tree therefore contains substantially more than Phase 1/1B as reported. That work is:

- **typecheck-clean, 17/17 unit tests passing, production build succeeds**
- **NOT visually verified** — I was interrupted mid-verification
- **uncommitted**

It should be treated as a draft pending review, not as delivered work.

### Deployed feature → current React implementation

Verified programmatically (Python string search over all 18 `src/**/*.ts{,x}` files; an initial `grep` pass gave false negatives on this machine and was discarded).

| Deployed feature | In React port |
|---|---|
| Activity heatmap (month blocks, levels, legend) | present (draft) |
| Year navigation + `earliestYearOffset` clamp | present (draft) |
| Streak / solved-today / in-range tiles | present (draft) |
| `Continue →` + jump + flash highlight | present (draft) |
| `completedAt` / `revisedAt` writes | present (draft) |
| ★ Revision-only filter | present (draft) |
| Filters mobile disclosure | present (draft) |
| No-results + clear-filters | present (draft) |
| Topic mini progress meter | present (draft) |
| Notes indicator dot | present (draft) |
| Merge import + summary | present (draft) |
| Undo import + backup key | present (draft) |
| Date-stamped export filename | present (draft) |
| Save-failure alert | present (draft) |
| Widened search haystack | present (draft) |
| A11y set (focus-visible, aria, touch, iOS 16px) | present (draft) |
| **Accordion open-state restore on filter clear** (`preFilterOpenState`) | **MISSING** |
| **Force-open gated on filter-input change** (`lastFilterSig` / `filterChanged`) | **MISSING** |
| **Analytics closed by default** | **DIVERGENT** — deployed closed, port open |

---

## 8. Missing functionality (precise)

1. **`preFilterOpenState` — accordion restore.** Deployed snapshots every `<details>` open state when filtering begins and restores it when filters clear. The port never restores, so clearing a filter leaves all 18 topics hanging open. This is the exact regression the upstream comment says it fixed.
2. **`lastFilterSig` / `filterChanged` gating.** Deployed force-opens accordions **only when a filter input actually changed**, so ticking a checkbox doesn't re-explode topics you just collapsed. The port's effect keys on `[filtersActive, anyVisible]`, and `anyVisible` shifts when you tick *done* while *hide-completed* is on — so collapsed topics can spring open on an unrelated action.
3. **Analytics default-open divergence.** Deployed `<details class="dash-analytics">` has no `open`; the stale version had `open`, and the port inherited the stale behaviour.

---

## 9. Data migration risks

1. **`version` was never bumped — `version: 1` now denotes two different shapes.** Pre-`ed5d1e3` entries have no date keys; post-`ed5d1e3` entries do. A migration that branches on `version` cannot tell them apart. It must branch on **field presence per problem**, not on the store version. *(Risk: HIGH)*
2. **Real localStorage is almost certainly a mix.** Anything solved before the heatmap shipped has no `completedAt`; anything after does. The plan's instruction to write `firstCompletedAt: null` would **discard genuine dates** for the post-heatmap subset. Migration must be: use `completedAt` when present, `null` when absent — never fabricate. *(Risk: HIGH — silent history loss)*
3. **Second localStorage key.** `dsa-tracker-progress-backup` is user-recoverable state the plan never mentions. §14's "never delete the v1 key" must extend to it, and the v2 migration must not orphan it. *(Risk: MEDIUM)*
4. **Two export shapes exist in the wild.** Files exported before and after `ed5d1e3` differ. Import/merge must tolerate both. Deployed handles this via `getState` defaulting; any v2 importer must do the same explicitly. *(Risk: MEDIUM)*
5. **The test fixture is pre-heatmap.** `~/Downloads/dsa-tracker-progress.json` (12 problems, dated Jul 31) has **no date fields**, so it exercises only the legacy path. Phase 2 needs a **fresh export from the deployed app** to test date-carrying migration. *(Risk: MEDIUM — untested path)*
6. **Staged index would delete deployed code.** See §2. *(Risk: HIGH if committed, trivially avoidable)*

---

## 10. Required plan changes

1. Rewrite §1 entirely against `origin/main`: file table, persistence schema (incl. both keys), and a complete feature inventory.
2. Delete the "*Question dates / history: None*" correction and replace it with the real date model.
3. Rewrite §4 step 5 — carry `completedAt` → `firstCompletedAt`/`lastCompletedAt` and `revisedAt` → `revisionStats.lastRevisedAt` where present; null only where genuinely absent. Add per-field presence detection. Add the backup key to the backup/rollback rules.
4. Update §11 `QuestionProgress` to name the v1 date fields as migration sources.
5. Update §7 to *port and extend* the existing notes indicator rather than introduce one.
6. Reduce Phase 8's merge work to "port `mergeStores`/`summarizeMerge`, already unit-tested".
7. Rewrite Phase 1 acceptance against the true inventory; add Phase 1C ("deployed-feature parity") covering the three §8 gaps.
8. Extend §13's manual smoke list to every deployed feature.
9. Update §12 so "visually unchanged" means *including* the dashboard.
10. Note in §14 that `ea95806` is the rollback point.

## 11. Required implementation changes

1. Implement `preFilterOpenState` save/restore.
2. Implement `filterChanged` gating so force-open fires only on filter-input change.
3. Make Analytics closed-by-default (pending §14 decision).
4. Complete the visual verification of the draft port — both themes, every state — which was interrupted.
5. Add unit tests for the two accordion behaviours.
6. Reset the git index before any commit.

## 12. What can be kept unchanged

- **All of Phase 0** — scripts, `idMap.json`, `idRegistry.json`, `questions.json`. Re-validated against deployed.
- **`data/fundamentals.json`** — 105/105 patterns match deployed pattern ids exactly; zero problem ids embedded. Frozen, do not regenerate.
- **All §2/§3/§9/§10 architecture decisions** — stack, no-database, IndexedDB, no-backend BYO-key LLM design.
- **§5/§6 revision engine and state-machine design** (subject to the §14 `revisedAt` decision).
- **The React/TS/Vite/Tailwind scaffold** from Phase 1/1B — structurally sound; it was incomplete, not wrong.

## 13. What must be redone

- Plan §1, §4, §7, §11, §12, §13 (rewrite).
- Phase 1 acceptance criteria and its verification pass.
- The three §8 behaviours.
- Full visual verification of the draft port.

---

## 14. Requires your explicit decision

1. **`revisedAt` semantics.** Today `revisedAt` = *when you last toggled the ★ star*, not when you actually revised anything — and the heatmap plots it as "revised". Once the real revision system lands there will be genuine revision events. Options: (a) keep ★ as a bookmark and add a separate `lastRevisedAt` for real revisions, plotting the real one; (b) keep both series; (c) repurpose `revisedAt`. **(a) is my recommendation** — non-destructive and keeps the heatmap honest.
2. **Analytics default-open** — match deployed (closed) or keep the port's open? I lean *match deployed*.
3. **Vanilla-app retention.** Phase 1 deleted `app.js` / `styles.css` / `data.js` — deletions authored against the stale files, which now read as deleting the deployed implementation. Keep them in-tree during migration as a live rollback, or rely solely on `ea95806` in git? I lean *rely on git* and keep the tree clean.
4. **Migration fixture.** Please export fresh progress from the deployed app so Phase 2 can be tested against real date-carrying data; the Downloads fixture predates the heatmap.
5. **Branching.** The plan says work on `feat/revision-system` with `main` as rollback. Nothing is committed yet — confirm you want the React work on a branch off `ea95806`.

---

## IS THE EXISTING PLAN STILL VALID?

### YES, WITH SPECIFIC CHANGES

The foundations survive intact: `data.js` never changed, so **Phase 0 and `fundamentals.json` are fully valid against the deployed baseline** — the two most expensive and most destructive-to-redo artifacts need no rework. Every architectural decision (React/TS/Vite/Tailwind, no database, IndexedDB, no backend, BYO-key LLM, revision state machine, spaced intervals) is untouched by all 9 commits, which are confined to three presentation/logic files.

What is genuinely invalid is the plan's **description of the existing application** and everything derived from it: the §1 baseline inventory, the §4 date-migration rule, and Phase 1's definition of done.

**Exact changes required:**

1. Rewrite plan §1 against `origin/main` — file table, persistence schema (both localStorage keys), full feature inventory.
2. Remove the false "no timestamps exist" correction; document `completedAt`/`revisedAt`.
3. Rewrite §4 migration: preserve real dates where present, detect per-field not per-version, cover the backup key.
4. Update §11, §7, §12, §13 per §10 above.
5. Re-scope Phase 8 merge to a port of existing tested logic.
6. Add Phase 1C for the three missing behaviours; re-verify Phase 1 against the corrected inventory.
7. Resolve the five §14 decisions — most importantly `revisedAt` semantics, which is the only one that touches the revision architecture.

**Not required:** regenerating `fundamentals.json`, redoing Phase 0, revisiting the stack, or re-deriving the ID scheme.
