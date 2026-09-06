# DSA Tracker

A single-page tracker for the Striver A2Z DSA sheet — problems grouped by topic and pattern, with checkboxes, filters, and progress stats. Built to replace an Excel sheet that was painful to keep updated.

**Live:** https://dsa-tracker.nsverse.app/

## Features
- 467 problems across 18 topics / 105 patterns, collapsible at both levels
- Mark done, flag for revision (★), add per-problem notes
- GitHub-style activity heatmap with day streak, year navigation, and a "Continue →" button that jumps to your next unsolved problem
- Search by name, topic, or pattern; filter by difficulty, importance, interview frequency, and "★ Revision only"
- Analytics panel: progress broken down by difficulty / importance / interview frequency
- Export/Import progress as a JSON file, with a one-step Undo after importing
- Merge progress from a second device: union of both — nothing already solved is ever un-solved, notes are combined

## Stack
React 19 + TypeScript + Vite. `data/questions.json` holds the problem list (generated once from the source spreadsheet). Progress is stored in the browser's `localStorage` — per-device only, no sync.

## Run locally
```
npm install
npm run dev
```
Other scripts: `npm run build` (typecheck + production build), `npm run preview` (serve the build), `npm test` (Vitest).

## Regenerating data/questions.json
The problem list comes from a spreadsheet one level above this repo. If it changes, regenerate with `scripts/convert.py`.

Problem ids are content-derived (`{patternId}__{slug(question)}`), not positional, so reordering or inserting spreadsheet rows never reassigns anyone else's progress. Every regeneration reconciles against `data/idRegistry.json`; if a question's text (or its pattern/topic name) changed enough to alter its id, the script prints the exact diff and aborts instead of landing it silently — re-run with `--accept` once you've reviewed it. `data/idMap.json` is a one-time, frozen bridge from the old `p1..p467` ids (used to migrate any pre-React-port `localStorage`) and should never be regenerated.
