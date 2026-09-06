# DSA Tracker — Architecture Upgrade + Intelligent Revision System

**Status:** Approved, then **rebaselined**. §1 and §4 were rewritten after the discovery that the original analysis ran against a baseline 9 commits behind the deployed app. See `REBASELINE_AUDIT.md`.
**Author:** Opus (architect). **Executor:** Sonnet (one phase at a time).
**Authoritative baseline:** `origin/main` @ `ea95806` — the deployed application. **Not** the earlier local `f471396`.
**Repo:** `/Users/nischaysharma/DSA/dsa-tracker` (git, remote `Nischay2123/DSA-PatterWise-Tracker`).

> **Phases 0, 1 and 1B are covered by `PHASE_0_1B_REMEDIATION.md`, not by this document.** They were implemented against the stale baseline and need parity fixes first. This plan governs **Phase 2 onward**. Do not start Phase 2 until the remediation plan's definition-of-done is met.

---

## Context

The tracker works today and is the source of truth for existing behaviour. The problem it does *not* solve: completing a question once teaches nothing durable. There is no retention loop, no dates, no evidence of recall — a checkbox click and a 467/467 bar can coexist with having forgotten Arrays entirely.

This plan adds a **topic-level spaced-repetition + active-recall layer** on top of the existing tracker, and modernises the shell (React/TS/Vite) only as far as the new layer actually requires. The existing UI, dataset, and localStorage progress survive intact.

---

## 1. Current architecture assessment

> **Rebaselined.** This section originally described `f471396`, which was 9 commits behind the deployed app. It now describes `ea95806`. Per-commit analysis: `REBASELINE_AUDIT.md` §3–4.

**Files** — 5 files, ~1,280 hand-written lines:

| File | Lines | Role |
|---|---|---|
| `index.html` | 105 | Static shell: header, progress bar, filters disclosure, `#dashboard` (Activity card), `#topics`, no-results, footer + Advanced/merge |
| `app.js` | 718 | Entire application: load/save/backup, render-to-innerHTML, delegated listeners, filters, heatmap, analytics, export/import/merge/undo |
| `styles.css` | 455 | Hand-written CSS, custom properties, dark mode, heatmap palette, a11y + touch rules |
| `data.js` | 162 KB | `const DATA = {...}` — one line, generated. **Byte-identical to `f471396`.** |
| `README.md` | 24 | Docs |

Plus `../scripts/convert.py` (one-shot xlsx→dataset, stdlib only) and `../.claude/launch.json`.

**Data model (static).** `DATA.topics[] → .patterns[] → .problems[]`.
18 topics / 105 patterns / 467 problems. Per problem: `id, subpattern, question, platform, link, difficulty, originalStep, estMinutes, importance, interviewFreq`.
`subpattern` is stored but **never rendered** — an unused axis worth reclaiming.

**Persistence.** **Two** `localStorage` keys:

```js
// "dsa-tracker-progress"
{ version: 1, problems: { [id]: {
    done: bool, revise: bool, notes: string,
    completedAt: "YYYY-MM-DD" | null,   // set when ticked done, cleared when un-ticked
    revisedAt:   "YYYY-MM-DD" | null,   // set when ★ starred, cleared when un-starred
} } }

// "dsa-tracker-progress-backup"  -- one-time pre-import snapshot, powers "Undo import"
{ version: 1, problems: { ... } }
```

`getState` defaults missing entries **and missing fields**, so absent keys are safe.

**Two critical schema facts:**

1. **`version` was never bumped when the date fields were added.** `version: 1` therefore denotes *two different shapes*: pre-heatmap entries have no date keys, post-heatmap entries do. **Migration must branch on per-problem field presence, never on `version`.**
2. **There was no backfill.** Anything completed before the heatmap shipped has no `completedAt`. Real user data is a **mix**.

**`revisedAt` means "when the ★ was last toggled", not "when the topic was revised."** The heatmap plots it as "revised". Locked decision: ★ remains a bookmark and `revisedAt` keeps this meaning; the revision system adds its own separate real-revision date (§5).

**Render model.** Full `innerHTML` rebuild of `#topics` on boot and on import ([app.js:78](dsa-tracker/app.js:78)). Mutations patch the DOM in place and recompute progress; they do **not** re-render. Filtering is CSS-class toggling (`.filtered-out { display:none }`), never removal — so `<details>` open-state survives. Notes commit on `focusout` ([app.js:211](dsa-tracker/app.js:211)), not on every keystroke.

**Verified feature inventory — the preservation contract (19 behaviours).**

*Tracking:* done checkbox · ★ bookmark flag · per-problem notes textarea (commits on blur) · **notes indicator dot** on problems that have notes · strikethrough on done · external problem links.

*Dates:* **`completedAt` written on completion** · **`revisedAt` written on starring**.

*Dashboard (`#dashboard`):* **activity heatmap** — month-block grid, 5 fixed intensity levels, legend, tooltip on hover + keyboard focus + tap, Escape to dismiss · **year navigation** (‹ / label / ›) clamped by `earliestYearOffset` · **stat tiles** — day streak, solved today, in-range · **`Continue →`** jump to next unsolved, opens ancestors, flash highlight · **summary line** `N solved · N revised on N active days`.

*Filtering:* text search across **question + topic + pattern + subpattern + platform** · difficulty pills · importance select · interview-freq select · hide-completed · **★ revision-only** · **filters collapse to a disclosure below 700px** · **no-results message with Clear-filters** · accordions force-open on filter change · **accordion open-state snapshotted and restored when filters clear**.

*Progress:* pattern `n/m` · topic `n/m` · **topic mini progress meter** · overall bar + `%` · analytics by difficulty / importance / interview-freq + starred count (**collapsed by default**).

*Data movement:* **date-stamped** JSON export · JSON import with **validation + confirm + one-time backup** · **Undo import** · **merge-import** (union: solved-in-either wins, earliest date wins, notes concatenated, never un-solves) with a change summary, behind an **Advanced** footer disclosure · **save-failure alert** on quota/private-mode.

*Chrome & a11y:* collapsible topic + pattern accordions · light/dark · `:focus-visible` outlines · `aria-label` / `aria-pressed` · coarse-pointer touch targets · 16px inputs (iOS zoom fix) · `prefers-reduced-motion` · WCAG-AA badge colours.

### Corrections to the brief

Three items listed as "existing, must be preserved" **do not exist**:

| Brief says existing | Reality |
|---|---|
| Database | **None.** No server, no DB, no API. `localStorage` only. |
| Pseudocode / code submission | **None.** One free-text `<textarea>`. |
| Question navigation | Nested `<details>` accordions. No router, no per-question view. |

**Question dates / history — these DO exist.** `completedAt` and `revisedAt` are written per problem and drive the heatmap, streak and stat tiles. *(The pre-rebaseline version of this plan wrongly claimed no timestamp existed anywhere. That error propagated into §4's migration rule and would have destroyed real history — see §4.)*

### The one real defect

**Problem IDs are positional.** `convert.py` assigns `p1…p467` by spreadsheet row index ([convert.py:60](scripts/convert.py:60)) and all progress is keyed on them. Insert one row in the sheet, regenerate `data.js`, and every subsequent question inherits a stranger's completion state — silently, with no error. The README half-acknowledges this. **This is fixed in Phase 0 before anything else touches the data.**

### ID mapping — full verification (measured against `data.js`, nothing assumed)

Run before finalizing. `slugify` was copied verbatim from [convert.py:20](scripts/convert.py:20), not reimplemented.

| Check | Result |
|---|---|
| Problems in `data.js` | **467** |
| Current ids all match `p\d+` | yes — **no exceptions** |
| Numeric range / contiguity | `p1..p467`, contiguous `1..N` |
| Ids equal row position | **yes** — confirms positional assignment empirically |
| Proposed `{patternId}__{slug(question)}` unique | **467 / 467, 0 collisions** |
| Empty / degenerate question slugs | **none** |
| Illegal characters, trailing `-`, `___` | **none** |
| Longest generated id | 100 chars (`stack-queue__expression-problems__minimum-number-of-bracket-reversals-to-make-an-expression-balanced`) |
| `idMap` old→new is a 1:1 bijection | **yes** — 467 entries, 467 distinct values, no new id claimed by two old ids |
| Deterministic across re-runs | **yes** — `slugify` is pure regex, no locale/hash/state |
| Duplicate question text within a pattern | **0** |
| Duplicate question text across patterns | **0** |

**Pattern-id stability (what `fundamentals.json` depends on):**

| Check | Result |
|---|---|
| Pattern ids unique | **105 / 105** |
| `patternId == topicId + "__" + slug(patternName)` | **true for all 105** |
| `topicId == slug(topicName)` | **true for all 18** |
| Does Phase 0 alter any pattern or topic id? | **No.** Phase 0 rewrites `problem["id"]` only; `pattern["id"]` and `topic["id"]` are separate fields it never touches. |
| `fundamentals.json` keys == `data.js` pattern ids | **exact set equality** |
| Problem ids (`p\d+`) embedded anywhere in `fundamentals.json` | **none** — the file is problem-id-free |

**Conclusion:** `{patternId}__{slug(question)}` is a safe stable replacement, and `fundamentals.json` is fully decoupled from the Phase 0 change. It needs no edit now and no edit when Phase 0 lands.

**Residual risk (not currently triggered, but real).** Content-derived ids are stable against *row reordering* — the actual defect — but not against *question text edits*. Fixing a typo in the spreadsheet would silently mint a new id and orphan that question's progress. There are zero duplicate question texts today, so the scheme is sound as-is; the hardening is in Phase 0 below (frozen registry + unmatched-row report), which converts a silent corruption into a loud, reviewable diff.

**Not yet verifiable here:** the migration has been proven correct against `data.js`, but not against *your actual saved progress* — I have no access to your browser's localStorage. Export your progress JSON before Phase 0 runs and the migration test should be run against that real fixture.

---

## 2. Recommended target architecture

**React 19 + TypeScript + Vite 6.** Justified: the revision session is genuinely stateful (multi-step form, async evaluation, resumable across refresh) and `innerHTML` string-building does not survive that. Not justified by the tracker list alone — but one app, one framework.

Deliberate **non**-additions, each with its ladder rung:

| Concern | Decision | Why |
|---|---|---|
| **Styling** | **Tailwind v4** via `@tailwindcss/vite`. Ported in its own phase (1B), *after* the React port lands. | Your call. Sequenced separately so any visual regression has exactly one possible cause. Existing CSS custom properties (`--easy`, `--border`, `--bg`, `--fg`, `--muted`, `--row-hover`) become `@theme` tokens so the palette and dark mode carry over rather than being re-derived. |
| **State** | React Context + `useReducer`, one `store.ts`. Text inputs uncontrolled, committed on blur. | Committing on blur is what the app already does and it keeps 467 rows off the keystroke path. Zustand/Redux buy nothing here. |
| **Routing** | `hashchange` + a `useHash()` hook, ~15 lines. 3 routes. | Native. Real back-button. No Vercel rewrite rules needed. `ponytail:` upgrade to react-router if routes exceed ~6. |
| **Persistence** | **IndexedDB** via `idb-keyval` (~600 B). | See §3. |
| **Validation** | `zod` — LLM response boundary only. | Untrusted input; hand-rolled parsing here is the wrong kind of lazy. Not used for internal types. |
| **Backend** | **None.** Pure static deploy. | See §9. The user supplies their own Gemini key in Settings; the browser calls Gemini directly. A public proxy holding a shared key would be an unauthenticated LLM endpoint any visitor could drain. |
| **Tests** | Vitest, pure logic only (migration, scheduler, state machine, scoring, selection). | No component tests, no E2E, no Playwright. |

Total new runtime dependencies: **react, react-dom, idb-keyval, zod.** Dev: vite, typescript, vitest, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite.

```
dsa-tracker/
├─ data/
│  ├─ questions.json             # migrated from data.js, stable ids
│  ├─ idMap.json                 # frozen p1..p467 → stable id
│  └─ fundamentals.json          # OPUS-AUTHORED, see §8
├─ src/
│  ├─ main.tsx  App.tsx  store.ts  useHash.ts
│  ├─ config.ts                  # REVISION_CONFIG — single source
│  ├─ types.ts
│  ├─ persistence/{db.ts,migrate.ts,backup.ts}
│  ├─ revision/{stateMachine.ts,scheduler.ts,selection.ts,scoring.ts,session.ts}
│  ├─ llm/{client.ts,providers.ts,schema.ts}
│  ├─ components/…
│  └─ index.css                  # @import "tailwindcss" + @theme tokens (was styles.css)
```
No `api/`, no `vercel.json` — the build output is fully static.

---

## 3. Database decision

**There is no database. Nothing to remove.** The brief's premise was wrong — confirmed by reading every file.

**A database must not be introduced.** All four tests fail:

| Test | Finding |
|---|---|
| Multi-user? | No. Single user, single dataset. |
| Cross-device sync? | **You chose export/import-with-merge.** No server needed. |
| Server-side revision history? | No. Schedules are pure functions of local timestamps. |
| Server-side secrets? | Only the LLM key — a 60-line stateless function, **not** a database. |

**Storage: IndexedDB, one key, via `idb-keyval`.** localStorage is a 5 MB hard cap that throws `QuotaExceededError` on write — with per-question notes + approach + pseudocode + code + mistakes across 467 questions, plus revision attempts and LLM payloads, that ceiling is reachable in normal use, and hitting it means silent data loss. IndexedDB removes the cliff. Cost is one 600 B dependency and an `await` at boot.

Shape (in memory as one object, persisted as one IDB value, debounced 400 ms):
```ts
{ schemaVersion: 2,
  progress:   { [stableId]: QuestionProgress },
  revision:   { [topicId]:  TopicRevision   },
  attempts:   { [attemptId]: RevisionAttempt },
  settings:   AppSettings }
```
Separate namespaces per brief §30. Static `questions.json` / `fundamentals.json` are never written.

The legacy `localStorage["dsa-tracker-progress"]` key is **read once and never deleted** — it is the rollback path.

---

## 4. Data migration & persistence strategy

Runs once, on first boot of the new app, in `persistence/migrate.ts`:

1. Read IDB. If `schemaVersion === 2`, done.
2. Read `localStorage["dsa-tracker-progress"]`. Absent → seed empty v2, done.
3. **Before touching anything**, write the raw legacy JSON to IDB key `legacy-backup-v1` *and* offer an automatic file download `dsa-tracker-backup-<date>.json`. Also copy `localStorage["dsa-tracker-progress-backup"]` to `legacy-backup-v1-undo` if present — it is user-recoverable state.
4. Map each `p{n}` → stable id via frozen `data/idMap.json`. Unknown key → park in `orphanedProgress`, never drop. *(If the ID migration already ran in the vanilla app, keys are already stable ids and pass through unchanged — detect via the `idsMigrated` flag.)*
5. Lift each legacy entry →
   ```ts
   { completed: done,
     starred: revise,                    // ★ bookmark — deliberately distinct from auto-revision
     notes: { legacy: notes, approach:"", keyInsight:"", commonMistake:"", complexity:"", edgeCases:"", reminder:"" },
     // PRESERVE real dates. Only null when genuinely absent -- never fabricate, never discard.
     firstCompletedAt: completedAt ?? null,
     lastCompletedAt:  completedAt ?? null,
     pseudocode:"", code:"", mistakes:[],
     revisionStats: { count: 0, lastRevisedAt: null, lastScore: null, lastConfidence: null },
     starredAt: revisedAt ?? null,       // v1 `revisedAt` is a STAR date, not a revision date
   }
   ```
6. Write v2. Leave **both** localStorage keys untouched.

**The date rule — do not get this wrong.** v1 `version: 1` covers two shapes: pre-heatmap entries have no `completedAt`, post-heatmap ones do (§1). Branch on **field presence per problem**, never on `version`. An earlier draft of this plan said to write `firstCompletedAt: null` unconditionally as *"unknowable — honestly null, never faked"*; against the real deployed data that would **silently delete genuine completion history**. Preserve what exists; null only what truly doesn't.

**`revisedAt` maps to `starredAt`, not to `revisionStats.lastRevisedAt`.** v1's `revisedAt` records when the ★ was toggled — it is not evidence of revision. `revisionStats.lastRevisedAt` stays `null` until the revision system writes a real one. Conflating them would fabricate a revision history and corrupt the first scheduling cycle.

**Rules Sonnet must not break.** Migration is pure and unit-tested against a **real export taken from the deployed app** (a pre-heatmap fixture is insufficient — it never exercises the date path). `idMap.json` is generated once and committed **frozen** — never regenerated. Old notes land in `notes.legacy`, rendered first in the editor, never parsed or reformatted. `completed: true` from v1 is **grandfathered** past the new pseudocode gate (§7). If migration throws, the app boots read-only with a visible error and an export button — it does **not** write.

---

## 5. Revision-system architecture

**Unit = topic** (18), per the brief's 75%-of-a-data-structure rule. **Fundamentals = pattern** (105); a topic session draws from its own patterns' fundamentals.

```
completion% (derived from progress)
        │  ≥ REVISION_CONFIG.completionThreshold
        ▼
 schedule created ──→ nextDueAt = now + intervalDays[cycle]
        │  now ≥ nextDueAt
        ▼
   REVISION_DUE ──→ topic gated (§6) ──→ start session
        │
        ▼
 SESSION: fundamentals + question recall + confidence
        │  submit
        ▼
 browser ──(user's own key)──→ Gemini ──→ structured JSON ──→ zod
        │                                  │
     pass ▼                                ▼ fail / unreachable
  cycle++, ungate                    stay gated, weakConcepts++, retry
```

`config.ts` — every tunable, referenced nowhere else as a literal:
```ts
export const REVISION_CONFIG = {
  completionThreshold: 0.75,
  intervalDays: [7, 14, 30, 60, 90],      // index = cycle; beyond → last value
  passScore: 70,
  criticalConceptFloor: 2,                 // core concept scoring < 2/5 ⇒ fail regardless of total
  fundamentalsPerSession: 4,
  questionsPerSession: 3,
  masteryCycles: 3,                        // + 100% completion ⇒ MASTERED
  weakBoostFactor: 3,
  gracePeriodDays: 0,
  exemptTopics: ['fundamentals'],          // never schedules revision; see §8 thin-patterns note
} as const;
```
`exemptTopics` topics are permanently `NOT_STARTED`/`IN_PROGRESS`, are never gated, and are omitted from every dashboard count.

**Interaction with the existing ★ and heatmap (locked decision).** The deployed app already has a ★ "mark for revision" bookmark that writes `starredAt`, a "★ Revision only" filter, and a heatmap that plots those star dates as a *"revised"* series. The new revision system is **additive and must not repurpose any of it**:

- ★ stays a manual bookmark. Its filter and analytics count keep working unchanged.
- Real revision events write `revisionStats.lastRevisedAt` and `TopicRevision.history` — never `starredAt`.
- Once real revision data exists, the heatmap's "revised" series should plot **real revisions** (Phase 8). Until then it keeps plotting star dates, exactly as deployed. Whichever it plots, the summary line's wording must match.
- No migration touches `starredAt`.

---

## 6. Revision state machine

**Derived, never stored.** `deriveState(topicRevision, completionPct, now)` is a pure function; only the facts below are persisted:

```ts
type TopicRevision = {
  topicId: string;
  cycle: number;                   // successful passes
  nextDueAt: string | null;        // ISO
  lastPassedAt: string | null;
  lastFailedAt: string | null;
  activeSessionId: string | null;
  history: { at: string; score: number; passed: boolean; attemptId: string }[];
  weakConcepts: Record<string, number>;   // conceptId | questionId → weight
};
```

| State | Condition |
|---|---|
| `NOT_STARTED` | completion == 0 |
| `IN_PROGRESS` | 0 < completion < threshold |
| `REVISION_SCHEDULED` | ≥ threshold, `now < nextDueAt` |
| `REVISION_DUE` | ≥ threshold, `now ≥ nextDueAt` |
| `REVISION_IN_PROGRESS` | `activeSessionId != null` |
| `REVISION_FAILED` | last history entry failed **and** still due |
| `MASTERED` | `cycle ≥ masteryCycles` && completion == 1 |

`REVISION_PASSED` is deliberately **not** a state — passing transitions straight to `REVISION_SCHEDULED` with a new `nextDueAt`. A transient state that only ever lasts one tick is a bug source; the pass is recorded in `history`.

**Gating — precise scope.** When `REVISION_DUE` or `REVISION_FAILED`:
- **Blocked:** marking a not-yet-completed question in that topic as done. Only that.
- **Allowed:** viewing everything, notes, mistakes, pseudocode/code on already-done questions, un-completing, starring, search, filters, analytics, all history, all fundamentals, other topics.
- The blocked checkbox is `disabled` with a title, plus an inline banner "Revision due — [Start revision]". **Nothing is hidden or removed.**

Interval advance: pass → `cycle++`, `nextDueAt = now + intervalDays[min(cycle, len-1)]`. Fail → `cycle` unchanged, `nextDueAt` unchanged (stays due), weak concepts incremented, retry immediately available.

---

## 7. Completion / pseudocode / notes changes

**Completion gate.** Marking a question done requires non-empty `pseudocode` **or** `code`. Clicking the checkbox opens a small completion panel (approach / pseudocode / code / notes) instead of toggling instantly.
Non-negotiable exemptions, or this destroys existing data: every question already `completed` at migration is **grandfathered** — never retroactively invalidated, never un-completed, editable but not re-gated. Un-checking is always free. `settings.requireEvidence` defaults `true` and can be turned off (the brief wants enforced learning; it also wants minimal friction — the switch resolves that without a second opinion).

**Notes.** Structured fields (Approach / Key Insight / Common Mistake / Complexity / Edge Cases / Personal Reminder) **plus** the preserved `legacy` blob rendered as a "Previous notes" field at the top. Nothing is parsed out of legacy text — heuristic splitting would corrupt it.

**The notes indicator already ships** — deployed marks the notes button with a bold `•` when a problem has notes. **Extend that existing affordance; do not invent a parallel one.** `hasNotes` must become "any structured field OR legacy non-empty" so migrated notes keep their marker.

**Mistakes.** `mistakes: { at: ISO, what: string, remember: string }[]` per question. Surfaced during that question's next recall and fed into weak-area weighting.

---

## 8. Fundamentals & active recall

### `data/fundamentals.json` — APPROVED STATIC CONTENT, AUTHORED BY OPUS

**Sonnet must not generate, regenerate, or rewrite this file.** Sonnet consumes it. If Sonnet finds an entry incomplete or technically wrong, it **reports the pattern id and the issue** and stops — it does not silently fix it.

Coverage: **all 105 patterns**, 5–8 concepts each (~630 total), keyed by the exact pattern ids in `data.js`.

```json
{ "version": 1,
  "patterns": {
    "arrays__sliding-window": {
      "patternName": "Sliding Window",
      "topicId": "arrays",
      "concepts": [
        { "id": "arrays__sliding-window__c1",
          "prompt": "What signal in a problem statement tells you a sliding window applies, and what disqualifies it?",
          "expectedConcepts": ["contiguous subarray or substring",
                               "answer is monotone as the window grows/shrinks",
                               "disqualified when elements may be skipped (that is subsequence/DP)"],
          "criticality": "core",
          "tags": ["applicability", "recognition"] }
      ] } } }
```

`criticality: "core"` drives the §15 hard-fail rule. `tags` drive weak-area targeting.
Authoring rules: pattern-specific (Sliding Window ≠ Binary Search), tests applicability / non-applicability / invariants / recognition signals / common mistakes / complexity / edge cases / variations / trade-offs / neighbouring-pattern distinctions. No "what is X" trivia. Answerable from memory in 1–3 sentences.
### Delivered — verification report

`data/fundamentals.json` exists in the repo (308 KB). Machine-verified:

| Check | Result |
|---|---|
| Every pattern in `data.js` has an entry | **105 / 105**, zero missing, zero extra |
| `patternName` / `topicId` match `data.js` exactly | **0 mismatches** |
| Duplicate pattern entries | **0** |
| Concept ids unique | **550 / 550** |
| Duplicate prompt text anywhere | **0** |
| Valid JSON, consistent schema | **pass** — every concept has exactly `{id, prompt, expectedConcepts, criticality, tags}` |
| Concepts per pattern within 5–8 | **pass** (89 patterns have 5, 10 have 6, 3 have 7, 3 have 8) |
| Generic "what is X" trivia prompts | **0** |
| Concept id derives from its pattern id | **pass** |

**Totals:** 550 concepts — 417 `core`, 133 `supporting`. Per topic: graphs 63, dp 51, trees 46, linked-list 45, arrays 40, backtracking 40, stack-queue 35, binary-search 33, recursion 31, bst 30, fundamentals 26, strings 20, heaps 20, greedy 20, bit-manipulation 17, tries 15, sorting 10, advanced-strings 8.

**Manual-review list — Sonnet must handle, not fix:**
1. `fundamentals__logical-thinking` has **no `core` concept** (both are `supporting`). This is deliberate: puzzle heuristics are not core DSA. **The loader and `scoring.ts` must tolerate a pattern with zero `core` concepts** — the critical-concept floor rule simply does not apply there. It is in the exempt topic, so this never affects a real revision.
2. 62 of 550 concepts have a single `expectedConcepts` entry. These are genuinely single-fact questions (e.g. the 3×3-box index formula); padding them would add noise, not grading signal. Not a defect.
3. The five `fundamentals` topic patterns are thin by nature — see the note below. They exist for completeness and are never scheduled.

Content is Opus-reviewed for technical accuracy. If you find an error, report the concept id — do not regenerate the file.

### Impact of the three flagged cases — explicit

| Flagged case | Revision architecture | Loader | Scoring | Data schema | `fundamentals.json` |
|---|---|---|---|---|---|
| **1.** `fundamentals__logical-thinking` has zero `core` concepts | **No change** | **Small change required** | **Small change required** | **No change** | No edit |
| **2.** 62 concepts have one `expectedConcepts` entry | **No change** | **No change** | **No change** | **No change** | No edit |
| **3.** Positional problem ids (`p1..p467`) | **No change** | **No change** | **No change** | **Change required — already Phase 0** | **No edit** (verified problem-id-free) |

**Case 1 — the two required changes, precisely.**

- *Loader:* must **not** assert `core >= 1` per pattern. A pattern whose concepts are all `supporting` is valid input, not corrupt data. One guard, not a redesign.
- *Scoring:* the `criticalConceptFloor` rule must be evaluated as **`every(coreConcepts, c => c.score >= floor)`**, which is vacuously `true` on an empty set. This is a real bug risk, not a style note: the natural alternative implementation — *"average core score >= floor"* — divides by zero on this pattern, yields `NaN`, and `NaN >= 2` is `false`, so **every revision touching it would silently fail with no error**. Sonnet must use the `every` form and there must be a unit test asserting a zero-core pattern passes the floor rule.

Neither change touches the state machine, the scheduler, the session model, or any persisted type. `criticality` remains a two-value enum with both values well represented (417 `core` / 133 `supporting`).

**Case 2 — nothing to change, with one prompt-wording caveat.** `expectedConcepts` is already typed `string[]` with `minItems: 1`; scoring is per-concept `0..5` returned by the LLM, never per-bullet. The only caveat is prompt phrasing: the evaluator prompt must not say *"award points per matched bullet"*, which would make single-bullet concepts effectively pass/fail while multi-bullet ones stay graded. Phrase it as *"score how completely the answer demonstrates the listed concepts"*. That is a prompt string, not a schema or code change.

**Case 3 — the schema change is confined to Phase 0 and the v1→v2 migration**, both already specified. Verified consequences: revision data keys on `topicId` and `questionId`, so it inherits whatever the canonical id is with no code change; `fundamentals.json` keys on pattern ids, which Phase 0 does not touch, and contains no problem ids at all. **No revision, loader, or scoring change follows from Case 3.**

**Thin patterns.** The five patterns under the `fundamentals` topic — `language-basics`, `pattern-printing`, `basic-maths`, `basic-hashing`, `logical-thinking` — have no honest DSA fundamentals worth spaced repetition. They still receive entries (all 105 covered, as required), but the whole `fundamentals` topic sits in `REVISION_CONFIG.exemptTopics` and is never scheduled or gated. Its 45 problems still count toward overall progress exactly as they do today.

### Active recall

Session picks `questionsPerSession` completed questions from the topic. Shows question text, link, difficulty, pattern. **Hides** the stored approach/pseudocode/code/notes. User submits approach + pseudocode + complexity (+ optional edge cases), then confidence `strong | partial | forgot`. **Only after submit** are the previous solution and notes revealed side-by-side with the LLM's feedback.

**Selection weighting** (`revision/selection.ts`, pure + tested) — never random:
```
weight = 1
  × (weakConcepts[id] ? weakBoostFactor : 1)
  × (lastConfidence === 'forgot' ? 3 : lastConfidence === 'partial' ? 1.75 : 1)
  × (lastRevisionScore < passScore ? 2 : 1)
  × (mistakes.length ? 1.5 : 1)
  × (difficulty === 'Hard' ? 1.4 : difficulty === 'Medium' ? 1.15 : 1)
  × (1 + daysSinceLastRevised / 30)
  × (neverRevised ? 1.5 : 1)
```
Seeded shuffle, no repeat within a session, prefer spreading across distinct patterns.
Confidence is **learning data, never a score** — it only moves future weights.

---

## 9 & 10. LLM architecture and secure integration

**No backend. The user supplies their own API key in Settings; the browser calls the provider directly.**

**Why this beats a serverless proxy here.** The site is public at `dsa-tracker.nsverse.app`. A Vercel function holding *your* key is an unauthenticated LLM endpoint — anyone who finds the URL can spend your quota, and defending it would need auth, rate limiting, and abuse monitoring, i.e. exactly the infrastructure this project is trying not to have. Moving key custody to the user removes the attack surface entirely and removes the backend with it.

**What the brief's rule actually forbids, and how this satisfies it.** The rule is that a *real key must never be shipped in frontend JavaScript*. It is not. No key is in the source, the bundle, `data/`, `.env`, `VITE_*` (which Vite inlines into client code), or git. The only key that ever exists is one the user pastes into their own browser at runtime, stored in their own IndexedDB.

**Key lifecycle.**
1. Settings holds `apiKey`, `provider` (`gemini` | `grok`), `model` — all user-editable, all persisted in IDB alongside other settings.
2. Starting a revision with no key set does **not** block the session. The session runs and submits normally; evaluation lands in the existing `PENDING` state with *"No API key set — [Add key in Settings]"*, and retries once a key exists.
3. A key is validated on save with one cheap probe call; a bad key is reported immediately rather than at the end of a revision.
4. Settings offers **Clear key**. Export **never** includes the key — it is excluded from the export payload explicitly and tested for.

**Honest risk statement.** A key in browser storage is readable by any script running on the page. Mitigations, all of which the plan already requires: no third-party scripts, no CDN (the CSP-free static bundle is entirely first-party), no `innerHTML` of untrusted content, and no analytics. The Settings panel must display a one-line warning telling the user to restrict the key by HTTP referrer in Google AI Studio and to use a key dedicated to this app. This is the standard trade for a client-side personal tool and is strictly safer than an open public proxy.

**Provider layer.** `llm/providers.ts` is a small registry `{ gemini, grok }` — one interface (`buildRequest`, `parseResponse`), two adapters, no framework. Gemini is the default: `gemini-2.5-flash` with `responseMimeType: "application/json"` + `responseSchema`. Model id lives in settings, not in code, so a quota or model change is a text-field edit.

**Client contract** (`llm/client.ts`): 20 s `AbortController` timeout, one retry on 5xx/network, never retries 4xx. Maps failures to `{ error: "NO_KEY" | "BAD_KEY" | "RATE_LIMIT" | "TIMEOUT" | "NETWORK" | "UPSTREAM" | "INVALID_RESPONSE" }`. Payload capped at 32 KB.

**Unverified assumption for Phase 7 to check first:** that `generativelanguage.googleapis.com` returns permissive CORS headers for direct browser `fetch`. It is widely used this way, but Sonnet must confirm with a real browser call **before** building the UI on top of it. If CORS turns out to be blocked, the fallback is a minimal Vercel proxy that **forwards the user's key from the request** and never stores one server-side — preserving the no-shared-key property. Do not silently switch to a shared-key proxy.

**Response schema** (zod-validated on *both* sides; every numeric field clamped, unknown fields stripped):
```ts
{ passed: boolean, score: 0..100,
  perFundamental: [{ conceptId, score: 0..5, missing: string[], note: string }],
  perQuestion:    [{ questionId, correctness: 0..5, approach: 0..5,
                     pseudocode: 0..5, complexity: 0..5,
                     mistakes: string[], note: string }],
  weakConcepts: string[], feedback: string, recommendedFocus: string[] }
```

**Grading instruction (brief §14) is a hard prompt constraint:** grade on *semantic correctness*, not similarity to the stored solution. A different valid approach with correct complexity scores full marks. Flag only genuine conceptual errors — never naming, style, or language choice. `passed` is computed **client-side** from the numbers by `scoring.ts`; the model's own `passed` is advisory and never authoritative.

**Failure is never silent (brief §29).** The attempt is written to IDB *before* the fetch. On any failure it stays `evaluationStatus: "PENDING"`, banner reads *"Evaluation unavailable. Your submission has been saved."*, topic stays **gated** (unchanged — not passed, not failed), retry button re-sends the identical stored payload. A pending attempt survives refresh and browser close and is retryable days later.

---

## 11. Data models

```ts
type QuestionProgress = {
  completed: boolean; starred: boolean;
  starredAt: string | null;            // <- v1 `revisedAt`. A bookmark date, NOT a revision date.
  firstCompletedAt: string | null;     // <- v1 `completedAt` when present, else null
  lastCompletedAt: string | null;      // <- v1 `completedAt` when present, else null
  approach: string; pseudocode: string; code: string;
  notes: { legacy: string; approach: string; keyInsight: string;
           commonMistake: string; complexity: string; edgeCases: string; reminder: string };
  mistakes: { at: string; what: string; remember: string }[];
  revisionStats: { count: number; lastRevisedAt: string | null;   // real revisions only
                   lastScore: number | null; lastConfidence: 'strong'|'partial'|'forgot'|null };
};

type RevisionAttempt = {
  id: string; topicId: string; startedAt: string; submittedAt: string | null;
  fundamentals: { conceptId: string; answer: string }[];
  questions:    { questionId: string; approach: string; pseudocode: string;
                  complexity: string; edgeCases: string;
                  confidence: 'strong'|'partial'|'forgot' }[];
  evaluationStatus: 'DRAFT'|'PENDING'|'OK'|'FAILED_PERMANENT';
  evaluation: EvaluationResult | null;
  error: string | null;
};
```
`TopicRevision` in §6.
`AppSettings`: `{ requireEvidence: boolean; llmEnabled: boolean; theme: string; provider: 'gemini'|'grok'; model: string; apiKey: string }` — `apiKey` is user-entered, browser-only, and **excluded from export** (§9).

---

## 12. UI/UX changes

Three hash routes: `#/tracker` (default, the existing view), `#/revision` (dashboard), `#/revision/:topicId` (session).

**Tracker** — visually unchanged **relative to the deployed app**, which means the header, filters (incl. the mobile disclosure and ★ revision-only), the whole Activity dashboard (heatmap, year nav, stat tiles, Continue →, summary line), collapsed-by-default Analytics, topic meters, no-results message and the Advanced/merge footer all stay exactly as they are. Additions: a revision status chip on each topic summary; a due-banner + disabled checkboxes on gated topics; the checkbox opens the completion panel; the existing notes `•` indicator extended to structured notes.

**Revision dashboard** — counts (Due today / Upcoming / Overdue / Strong / Weak / Mastered) then a topic list `🔴 Arrays — Revision Due` · `🟡 Trees — due tomorrow` · `🟢 Hashing — next in 9 days`, each expandable to full history, scores, and weak concepts.

**Session** — linear: fundamentals → question recall → confidence → submit → results. Autosaves every step to IDB, so a refresh resumes exactly. Results reveal the stored solution beside the LLM's per-item feedback.

No gamification: no streak flames, no points, no badges. Existing accordion/filter/search behaviour is byte-for-byte preserved.

---

## 13. Testing strategy

Vitest, pure functions only. Must pass before a phase is considered done:

**Migration** — v1 fixture → v2 exact-match · unknown ids orphaned not dropped · legacy notes intact · empty/absent/corrupt localStorage · double-migration is a no-op · migration failure leaves IDB untouched · **`completedAt` present → carried into `firstCompletedAt`/`lastCompletedAt`** · **`completedAt` absent → null, never fabricated** · **a mixed store (some entries dated, some not) migrates correctly in one pass** · **`revisedAt` → `starredAt`, and `revisionStats.lastRevisedAt` stays null** · **`dsa-tracker-progress-backup` is preserved, not orphaned** · **already-stable-id stores (`idsMigrated: true`) pass through unchanged**.
**Scheduler** — 74.9% vs 75.0% threshold · interval sequence 7/14/30/60/90 · beyond-last clamps to 90 · fail does not advance · timezone/DST-proof (all UTC ISO, day math in whole days).
**State machine** — every state reachable, table-driven; gating blocks *only* new completions.
**Scoring** — pass at exactly 70 · fail at 69 · pass-by-total but a `core` concept below floor ⇒ fail · **a pattern with zero `core` concepts passes the floor rule vacuously** (guards the `NaN` divide-by-zero trap described in §8).
**Selection** — weak concept over-represented across 1000 seeded runs · no duplicates in a session · works when the topic has fewer completed questions than `questionsPerSession`.
**LLM boundary** — valid response · missing field · wrong types · out-of-range numbers clamp · non-JSON body · truncated JSON · injected extra fields stripped. All rejected safely, none crash.

**Manual smoke, on real data, every phase.** Use the 25-row deployed-parity checklist in `PHASE_0_1B_REMEDIATION.md` §T4 — it is the authoritative regression list and covers the heatmap, streak, Continue, merge/undo, mobile disclosure and a11y that this section previously omitted. At minimum every phase: load with a **fresh export from the deployed app** → counts and heatmap identical → export/import round-trips → filters/search/accordions behave identically, including restore-on-clear.

**Failure cases explicitly exercised:** LLM down · invalid response · timeout · rate limit · no API key · refresh mid-session · browser closed mid-session · corrupted IDB · v1 data only · migration throw.

---

## 14. Migration & rollback

- Work on branch `feat/revision-system`, **branched from `ea95806`**; `main` @ `ea95806` (the deployed vanilla app) is the rollback.
- Phase 0 is already implemented and re-validated against the deployed dataset — see `PHASE_0_1B_REMEDIATION.md` §T1. Its artifacts are frozen.
- **Both** localStorage keys (`dsa-tracker-progress`, `dsa-tracker-progress-backup`) are **never deleted**.
- Always re-check `git status` / `git diff --cached` before committing: an earlier `git reset --soft` left the index holding a stale tree that would have deleted the deployed implementation.
- An auto-download backup fires before the first v2 write.
- `data/idMap.json` is committed frozen. Regenerating it is the single most destructive possible action.
- Any schema change bumps `schemaVersion` and ships a forward migration + test.
- Rollback: `git revert` the deploy. v1 localStorage is still there, untouched, and the old app reads it.

---

## 15. Implementation phases (exact order)

Each phase: one commit, tests green, manual smoke passed. **Sonnet does one phase per session and stops.**

---

### Phases 0, 1, 1B — see `PHASE_0_1B_REMEDIATION.md`

These three phases were implemented against the stale `f471396` baseline and are **not governed by this document**. Their current status:

| Phase | Status |
|---|---|
| **0 — Stable IDs** | **Complete and valid.** `data.js` is byte-identical across the 9 missed commits, so `idMap.json`, `idRegistry.json` and `questions.json` all re-validate against the deployed dataset (467 problems / 105 patterns / 18 topics). Frozen — never regenerate. |
| **1 — React/TS/Vite port** | **Incomplete.** Verified against the wrong feature inventory; shipped without ~16 deployed behaviours. A draft port of the missing features exists in the working tree (typecheck-clean, tests pass, build succeeds) but is **visually unverified and uncommitted**. |
| **1B — Tailwind v4** | Port done, but its acceptance depends on Phase 1 parity, so it re-verifies alongside Phase 1. |

Remaining work — git hygiene, three known behavioural gaps (accordion restore-on-clear, change-gated force-open, Analytics closed-by-default), unit tests, and a 25-row two-theme visual checklist — is specified in `PHASE_0_1B_REMEDIATION.md`.

**Phase 2 must not begin until that plan's definition-of-done is met.**

---

### Phase 2 — IndexedDB + v2 schema + migration
**Objective.** Move to IDB and the four-namespace model without losing a byte.
**Files.** `persistence/{db,migrate,backup}.ts`, `store.ts`, `types.ts`.
**Data.** v1 → v2 per §4. Backup written first.
**Depends on.** Phase 1. (Independent of 1B — may run before or after it.)
**Tests.** Full migration suite (§13).
**Acceptance.** Real localStorage data appears complete in IDB; app boots identically; localStorage key still present; backup file downloaded.
**Risks.** Highest-risk phase. Async boot must gate render (loading state, not a flash of empty). Debounced writes must flush on `visibilitychange`.

---

### Phase 3 — Notes editor, mistakes, dates, completion gate
**Objective.** Evidence-based completion and structured notes, without invalidating history.
**Files.** `components/{QuestionRow,NotesEditor,CompletionPanel,MistakeList}.tsx`, `store.ts`, `config.ts`.
**Data.** Populates `approach/pseudocode/code/notes.*/mistakes/firstCompletedAt/lastCompletedAt`.
**UI.** Completion panel; structured notes with "Previous notes" first; 🟢/⚪ dots; mistake entries.
**Depends on.** Phase 2.
**Tests.** Grandfathered completions stay completed and are never re-gated · gate blocks empty-evidence completion · `requireEvidence:false` bypasses · legacy notes text is byte-identical after an edit to another field.
**Acceptance.** Old completions untouched; new ones require pseudocode or code.
**Risks.** Friction. The settings toggle is the release valve. Never write a fake `firstCompletedAt` for migrated data.

---

### Phase 4 — Revision engine (headless, no UI, no LLM)
**Objective.** All revision logic as tested pure functions.
**Files.** `config.ts`, `revision/{stateMachine,scheduler,selection,scoring}.ts`.
**Data.** `TopicRevision` namespace.
**UI.** None — dev-only debug panel is acceptable, not shipped.
**Depends on.** Phase 2 (not 3).
**Tests.** Scheduler, state machine, scoring, selection suites (§13).
**Acceptance.** 100% of the branch table covered; crossing 75% on real data schedules correctly.
**Risks.** Date math — all UTC ISO, whole-day granularity, no `Date` arithmetic on locale strings. **And the zero-core-concept trap:** implement the critical-concept floor as `every(coreConcepts, …)`, never as an average over `coreConcepts.length`, which divides by zero on `fundamentals__logical-thinking` and silently fails every revision (§8).

---

### Phase 5 — Fundamentals wired in
**Objective.** Load and select from the approved dataset.
**Files.** `data/fundamentals.json` (**pre-existing, Opus-authored — do not create or modify**), `revision/session.ts`, loader + coverage assertion.
**Data.** Read-only.
**Depends on.** Phase 4.
**Tests.** Every pattern id in `questions.json` has a fundamentals entry · no duplicate concept ids · selection returns `fundamentalsPerSession` items spread across the topic's patterns · **a pattern with zero `core` concepts does not crash the loader or `scoring.ts`** (see §8 manual-review item 1).
**Acceptance.** Any topic yields a sensible fundamentals set.
**Risks.** A missing pattern must fail the build loudly. **If Sonnet believes content is wrong, it reports the pattern id — it does not regenerate the file.**

---

### Phase 6 — Revision session UI (local scoring, still no LLM)
**Objective.** Full session flow, resumable, with a self-assessment-only score.
**Files.** `components/revision/{SessionShell,FundamentalsStep,RecallStep,ConfidenceStep,ResultsStep}.tsx`, `revision/session.ts`, `useHash.ts`.
**Data.** `RevisionAttempt`, `activeSessionId`.
**UI.** `#/revision/:topicId`; gating banner + disabled checkboxes on the tracker.
**Depends on.** Phase 5, Phase 3.
**Tests.** Manual: refresh mid-session resumes exactly · close/reopen browser resumes · gating blocks only new completions · every other tracker action still works on a gated topic.
**Acceptance.** A session can be started, completed, and persisted end to end with no network.
**Risks.** Autosave granularity — save on every field blur and every step transition.

---

### Phase 7 — LLM evaluation (BYO key, no backend)
**Objective.** Validated, gracefully-degrading evaluation using a user-supplied key.
**Files.** `llm/{client,providers,schema}.ts`, `components/SettingsPanel.tsx`, `ResultsStep.tsx`, `store.ts`.
**Data.** `settings.{apiKey,provider,model}`; `evaluation`, `evaluationStatus`, `error` on the attempt.
**API.** None. Direct browser call to the provider.
**UI.** Settings panel with key field (masked, paste-friendly), provider/model selects, Validate and Clear buttons, and the referrer-restriction warning. Results step shows Evaluating / results / "saved, evaluation unavailable" + Retry / "No API key set" + link to Settings.
**Depends on.** Phase 6.
**Step 0 — do this before any UI work.** Confirm a direct browser `fetch` to `generativelanguage.googleapis.com` succeeds (CORS). If it fails, stop and report; do not fall back to a shared-key proxy (§9).
**Tests.** Full LLM boundary suite · every §13 failure case · missing key · invalid key · key present but quota exhausted · **grep the built bundle: no key-shaped string may be present** · **export payload must not contain `apiKey`**.
**Acceptance.** A real Gemini call with a user-entered key returns a validated result. Clearing the key produces the saved-not-scored path with a working retry. Nothing is ever auto-passed or auto-failed. The key never leaves the browser except in the request to the chosen provider.
**Risks.** Prompt injection via user pseudocode — user content goes in a delimited block, the model is told to treat it as data, and the response is schema-validated regardless. Never trust the model's `passed`. The key must never be written to an export, a log, a URL query string, or an error message.

---

### Phase 8 — Dashboard, weak-area feedback, export/import merge
**Objective.** Close the loop and finish sync.
**Files.** `components/revision/Dashboard.tsx`, `components/ImportExport.tsx`, `persistence/backup.ts`, `revision/selection.ts`.
**Data.** `weakConcepts` written from evaluations; merge extended to the v2 namespaces.
**UI.** Revision dashboard per §12; merge dialog showing what will change.
**Depends on.** Phase 7.

**Merge is mostly already built — extend, don't rewrite.** The deployed app ships `mergeStores` / `mergeNotes` / `earlierDate` / `summarizeMerge` with union semantics (solved-in-either wins, earliest date wins, notes concatenated, never un-solves), a confirm summary, a one-time backup and Undo import. That logic is already ported and unit-tested. Phase 8's job is to **widen it to the v2 shape**: merge `revision` / `attempts` namespaces, structured note fields (per-field union, legacy preserved), `mistakes` (union), and `revisionStats` (highest `count`, latest `lastRevisedAt`). Keep the existing confirm-summary and Undo affordances exactly as they are.

**Also in this phase:** switch the heatmap's "revised" series from `starredAt` to real revision dates now that they exist (§5), and update the summary-line wording to match.

**Tests.** Existing merge tests still pass · v2 namespaces merge without loss · union of mistakes/attempts/history · dry-run diff matches applied result · failed revision demonstrably over-weights its weak concepts next session · Undo import still restores after a v2 merge.
**Acceptance.** Two devices' exports merge without loss; dashboard counts match derived state; nothing already solved is ever un-solved.
**Risks.** Merge is the last place data can vanish. Always back up before applying; always show the diff first.

---

## Decisions — finalized

1. No database, now or later. IndexedDB + `idb-keyval`, one key, four namespaces.
2. React 19 + TS + Vite. Hash routing (no router dep). Context + `useReducer` (no state lib).
2b. **Tailwind v4**, ported in its own phase (1B) after the React port is visually confirmed. Existing CSS custom properties become `@theme` tokens.
3. Stable content-derived IDs, frozen `idMap.json`, Phase 0 first.
4. Revision unit = topic; fundamentals = pattern.
5. Revision state derived, not stored.
6. Gating restricts **only** new completions.
7. **No backend.** The user supplies their own API key in Settings, stored only in their browser; the browser calls the provider directly. Gemini default, pluggable provider, model id in settings. Rationale in §9: a public proxy holding a shared key is an open LLM endpoint any visitor can drain.
8. `passed` computed client-side; LLM output zod-validated; failures save-and-retry, never auto-pass/fail.
9. Migrated completions grandfathered past the evidence gate.
10. Legacy notes preserved verbatim in `notes.legacy`, never parsed.
11. `data/fundamentals.json` is Opus-authored approved content. Sonnet consumes only.
12. Vitest on pure logic only. No component/E2E tests.
13. `requireEvidence: true` by default, with a Settings toggle. Migrated completions grandfathered.
14. All 105 patterns get fundamentals entries, **and** the `fundamentals` topic (45 problems / 5 thin patterns) is listed in `REVISION_CONFIG.exemptTopics` so it never gates you on star-pattern trivia. Removing it from that array is a one-line change if you later disagree.

### Post-rebaseline decisions (locked)

15. **Authoritative baseline is `ea95806`** — the deployed app — not the earlier local `f471396`. All parity is measured against it.
16. **★ stays a bookmark.** v1 `revisedAt` migrates to `starredAt` and keeps its meaning. Real revisions write `revisionStats.lastRevisedAt`. No repurposing, no migration of star dates into revision history.
17. **Analytics is collapsed by default**, matching deployed.
18. **The vanilla app is deleted from the tree.** Rollback is `ea95806` in git, not a parallel copy.
19. **Work lands on `feat/revision-system`, branched from `ea95806`.** `main` stays the live rollback.
20. **Real completion dates are preserved on migration.** Branch on per-problem field presence; never fabricate a date, never discard one.

## Finalization status

**`data/fundamentals.json` — FINAL.** 105/105 patterns, 550 concepts, verified (§8). The ID audit (§1) confirmed it is keyed solely on pattern ids and contains zero problem ids, so **Phase 0 cannot invalidate it**. No edit needed now or later.

**Plan — FINAL**, pending one mechanical step: this file must be re-copied to `dsa-tracker/DSA_TRACKER_IMPLEMENTATION_PLAN.md`, which now lags behind by the §1 verification tables, the §8 impact matrix, and the Phase 0 hardening. That copy is the only outstanding write.

Both files remain **untracked and uncommitted** in `dsa-tracker/`.

## Decisions still needing your approval

None. Everything above is settled; the plan is ready to execute.

## What Sonnet must NOT change without asking

- `data/idMap.json`, `data/idRegistry.json`, `data/questions.json` — never regenerate.
- `data/fundamentals.json` — never generate or rewrite; report problems instead.
- **Either** localStorage key — `dsa-tracker-progress` and `dsa-tracker-progress-backup`. Never delete.
- Any of the 19 deployed behaviours in the §1 inventory — never drop one to simplify a phase.
- `starredAt` / ★ semantics — locked (decision 16).
- Never fabricate a completion date for an entry that has none.
- Visual appearance during the Tailwind port (1B) — match the old CSS exactly, do not "improve" spacing, colours, or type scale.
- Phase 1B must not be merged into Phase 1.
- Any value that belongs in `REVISION_CONFIG` — never inline a literal.
- The §1 feature inventory — never drop a feature to simplify a phase.
- Phase order — Phase 0 first, always.
- Adding a dependency beyond react, react-dom, idb-keyval, zod, vite, typescript, vitest, tailwindcss.
- Introducing **any** backend, or hard-coding a shared API key anywhere. If the CORS check in Phase 7 fails, report it — do not invent a shared-key proxy.
- Including `settings.apiKey` in an export payload, a log line, a URL, or an error message.
- Faking a timestamp for data that predates timestamps.

---

## Verification

```bash
npx vitest run
```
```bash
npm run build && grep -rE "AIza[0-9A-Za-z_-]{10,}|xai-[0-9A-Za-z]{10,}" dist/ && echo "LEAK" || echo "clean"
```
The key lives only in the user's IndexedDB at runtime, so the bundle must contain no key-shaped string at all. Also confirm an exported JSON backup contains no `apiKey` field.
Manual, before every merge: open with real existing localStorage → overall count matches the old app exactly → export, import into a fresh profile, counts match → search / difficulty / importance / freq / hide-completed all behave as before → topic and pattern accordions open and close → a gated topic still allows notes, history, and un-completing.

Phase 1B additionally requires the before/after screenshot set (both themes, every state listed in that phase) attached to the commit or PR.
