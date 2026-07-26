# DSA Tracker

A single-page tracker for the Striver A2Z DSA sheet — problems grouped by topic and pattern, with checkboxes, filters, and progress stats. Built to replace an Excel sheet that was painful to keep updated.

**Live:** https://dsa-tracker.nsverse.app/

## Features
- 467 problems across 18 topics / 105 patterns, collapsible at both levels
- Mark done, flag for revision, add per-problem notes
- Search by name; filter by difficulty, importance, and interview frequency
- Analytics panel: progress broken down by difficulty / importance / interview frequency
- Export/Import progress as a JSON file (backup, since there's no account/server)

## Stack
Plain HTML/CSS/JS, no build step, no framework. `data.js` holds the problem list (generated once from the source spreadsheet). Progress is stored in the browser's `localStorage` — per-device only, no sync.

## Run locally
Open `index.html` directly in a browser, or serve the folder:
```
python3 -m http.server 8000
```

## Regenerating data.js
The problem list comes from a spreadsheet one level above this repo. If it changes, regenerate with the converter script (kept outside this repo) and drop the new `data.js` in here — progress keyed by problem ID survives as long as topic/pattern names don't change.
