# DSA Tracker

A single-page tracker for the Striver A2Z DSA sheet — 467 problems grouped by topic and pattern, with a spaced-repetition revision system on top. Built to replace an Excel sheet that was painful to keep updated.

**Live:** https://dsa-tracker.nsverse.app/

## What it does

**Tracking.** 467 problems across 18 topics and 105 patterns, collapsible at both levels. Mark done, star for revision, keep six structured notes per problem plus your own list of mistakes. Search by name, topic or pattern; filter by difficulty, importance and interview frequency, show starred only, or hide what is already done. GitHub-style activity heatmap with day streak and year navigation, and a "Continue →" button that jumps to your next unsolved problem.

**The completion gate.** Marking a never-completed problem done asks for an approach plus pseudocode or code. With an API key configured, that solution is graded before the tick lands, and your six note fields are then written for you from it. Without a key the gate falls back to a presence check — a personal tracker must not hold your own progress hostage to a third-party credential. The whole gate is one switch in Settings.

**Revision.** A topic becomes revisable at 75% completion, then runs on intervals of 7/14/30/60/90 days. A session asks four fundamentals and three questions from memory; answers are graded, and the result moves the topic through `NOT_STARTED → IN_PROGRESS → REVISION_SCHEDULED → REVISION_DUE → REVISION_IN_PROGRESS → REVISION_FAILED → MASTERED`. Three passed cycles at 100% completion is mastery. Any topic with enough completed material can also be revised on demand.

**Goals.** A goal narrows what that 75% is measured against, so revision starts working in days instead of weeks. Presets: Full syllabus (the default, and inert), Skip the hard ones, Most asked, Hard practice, Blind 75 — or a custom frequency floor and difficulty set. A goal never hides anything; in-scope rows get a marker in the list.

**Your data.** Export and import as JSON with a one-step undo, and a merge that unions two devices — nothing already solved is ever un-solved.

## Stack

React 19 + TypeScript + Vite 6 + Tailwind v4. No runtime dependencies beyond React and `idb-keyval`.

Progress lives in IndexedDB, per-device, no sync. Two schemas coexist: the v2 `AppStoreV2` is the source of truth, and the older flat v1 `ProgressStore` survives as a UI-facing view over it — `v2ProgressToV1Store` reads, `patchV2FromV1` patches. Revision state is *derived* from completion and history, never stored, which is why a goal can change what revision measures without touching the scheduler.

LLM grading and note-writing are optional and bring-your-own-key (Gemini or Groq). The key is stored locally and never leaves the browser except to the provider you chose; it is never written into an export, a log or a URL.

## Run locally

```
npm install
npm run dev
```

`npm run build` (typecheck + production build) · `npm run preview` (serve the build) · `npm test` (Vitest, 528 tests) · `npm run test:coverage` · `npm run test:mutation` (Stryker).

There are no component or E2E tests by design — `.tsx` is excluded from coverage. Several DOM details are load-bearing instead of asserted: native `<details data-accordion>` for the two accordion levels, filtered rows hidden by the literal `hidden` *class* while staying mounted, `data-id` on the same element as `.problem-row`, and `MD_BREAKPOINT_PX` in `src/breakpoints.ts` matching `--breakpoint-md` in `index.css`. Changing any of them silently breaks search, filters or the jump-to-problem button.

## The data files

`data/questions.json`, `data/fundamentals.json`, `data/idMap.json` and `data/idRegistry.json` are frozen. Problem ids are content-derived (`{patternId}__{slug(question)}`), not positional, so reordering or inserting spreadsheet rows never reassigns anyone's progress.

The problem list is generated from a spreadsheet one level above this repo by `scripts/convert.py`. Every regeneration reconciles against `data/idRegistry.json`; if a question's text or its pattern/topic name changed enough to alter its id, the script prints the diff and aborts rather than landing it silently — re-run with `--accept` once reviewed. `data/idMap.json` is a one-time frozen bridge from the old `p1..p467` ids and must never be regenerated.

Two files sit beside them and are *not* frozen:

- `data/lists.json` — curated problem sets a predicate can't express, currently Blind 75. It references frozen ids and records the titles this sheet simply doesn't have, rather than padding the count with near-matches.
- `data/gfgLinks.json` — the sheet only ever recorded LeetCode URLs, leaving 213 rows unlinked. This maps 143 of them to their GeeksforGeeks practice equivalent, resolved against the GFG catalog and fetched to confirm. Near-matches are left unlinked on purpose. `problemLink()` in `src/links.ts` prefers the sheet's own link and falls back here.
