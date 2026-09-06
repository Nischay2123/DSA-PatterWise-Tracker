# Phase 0 → 1B Remediation Plan

**Scope:** everything up to and including Phase 1B. Phase 2 onward lives in `DSA_TRACKER_IMPLEMENTATION_PLAN.md`.
**Executor:** Sonnet. **Authoritative baseline:** `origin/main` @ `ea95806` (the deployed app).
**Read first:** `REBASELINE_AUDIT.md`.

---

## Context

Phases 0, 1 and 1B were implemented against a local baseline (`f471396`) that was **9 commits behind** the deployed app. Those 9 commits added an activity heatmap, date tracking, merge-import and a large accessibility pass. Phase 1's parity target was therefore wrong, and the React port shipped without ~16 deployed features.

**What survived intact:** `data.js` is byte-identical across all 9 commits, so **all Phase 0 artifacts and `data/fundamentals.json` are valid** and require no rework.

**Current working tree:** contains a *draft* port of the missing features, written after the discrepancy was found. It is typecheck-clean, 17/17 tests pass, and the production build succeeds — but it was **never visually verified** and is uncommitted. Treat it as a draft to review and finish, not as delivered work.

### Decisions already made (do not revisit)

| Decision | Ruling |
|---|---|
| `revisedAt` semantics | ★ stays a **bookmark**. `revisedAt` keeps its current meaning (star toggle). The revision system will add its own separate real-revision date later. Heatmap keeps plotting `revisedAt` for now. **No migration, no semantic change in this phase.** |
| Analytics default state | **Closed** by default — match deployed. |
| Vanilla app files | **Delete** `app.js` / `styles.css` / `data.js` from the tree. Rollback is `ea95806` in git. |
| Branching | Branch off `ea95806`. `main` stays the live rollback. |

---

## T0 — Git hygiene (do this first, before touching code)

The index currently holds the **stale** tree while `HEAD` is the deployed commit. `git diff --cached --stat` shows ~804 deletions across `app.js` / `index.html` / `styles.css`. **Committing as-is would delete the deployed implementation.**

```bash
cd dsa-tracker && git restore --staged . && git status --short
```

Then branch off the deployed baseline:

```bash
git checkout -b feat/revision-system ea95806
```

**Acceptance:** `git status` shows the React work as uncommitted changes on `feat/revision-system`; `git diff --cached` is empty; `git log -1` is `ea95806`.

**Do not** `git reset --hard`, `git clean`, or `git checkout .` — the draft port is uncommitted and would be destroyed.

---

## T1 — Re-validate Phase 0 (verification only, no code changes)

Already verified during the audit; re-assert before building on it.

```bash
cd dsa-tracker && python3 - <<'PY'
import json, subprocess, re
raw = subprocess.run(["git","show","ea95806:data.js"],capture_output=True,text=True).stdout
dep = json.loads(raw[len("const DATA = "):].rstrip().rstrip(";"))
pat = {p["id"] for t in dep["topics"] for p in t["patterns"]}
prob = [q["id"] for t in dep["topics"] for p in t["patterns"] for q in p["problems"]]
q = json.load(open("data/questions.json")); f = json.load(open("data/fundamentals.json"))
m = json.load(open("data/idMap.json"))
qp = {p["id"] for t in q["topics"] for p in t["patterns"]}
qi = [x["id"] for t in q["topics"] for p in t["patterns"] for x in p["problems"]]
assert len(prob)==467 and all(re.fullmatch(r"p\d+",i) for i in prob)
assert qp==pat and set(f["patterns"])==pat
assert set(m)==set(prob) and set(m.values())==set(qi)
print("Phase 0 artifacts VALID against deployed baseline")
PY
```

**Acceptance:** prints `VALID`. **Never regenerate** `idMap.json`, `idRegistry.json`, or `fundamentals.json`.

---

## T2 — Close the three known gaps

The draft port already covers 16 of 19 deployed behaviours. These three are missing or wrong. Reference implementation: `git show ea95806:app.js`, function `applyFilters` (~line 351).

### T2.1 — Accordion open-state restore + change-gated force-open

Two deployed behaviours the port lacks:

- **`preFilterOpenState`** — deployed snapshots every `<details>` open state when filtering starts and **restores it when filters clear**. Without it, clearing a filter leaves all 18 topics hanging open.
- **`lastFilterSig` / `filterChanged`** — deployed force-opens accordions **only when a filter input actually changed**. The port's effect keys on `[filtersActive, anyVisible]`, and `anyVisible` shifts when you tick *done* while *hide-completed* is on — so collapsed topics spring open on an unrelated action.

**Implementation — centralise, don't patch per-component.** Deployed does this in one pass; the port should too.

1. Add `data-accordion` to the `<details>` in **both** `TopicList.tsx` (`TopicItem`) and `PatternGroup.tsx`.
2. **Remove** the existing `useEffect` force-open blocks from both components, and their now-unused `detailsRef`.
3. Add `src/useFilterAccordions.ts` and call it once from `App.tsx`:

```ts
// Mirrors applyFilters() in ea95806:app.js. <details> open state is uncontrolled
// DOM state, so this is deliberately imperative and runs after children render.
export function useFilterAccordions(filters: FilterState) {
  const lastSig = useRef("");
  const snapshot = useRef<Map<HTMLDetailsElement, boolean> | null>(null);

  useEffect(() => {
    const sig = [filters.search.trim().toLowerCase(), filters.difficulty, filters.importance,
                 filters.freq, filters.hideCompleted, filters.reviseOnly].join(" ");
    const changed = sig !== lastSig.current;
    lastSig.current = sig;
    const active = areFiltersActive(filters);
    const all = Array.from(document.querySelectorAll<HTMLDetailsElement>("details[data-accordion]"));

    if (active && changed && !snapshot.current) {
      snapshot.current = new Map(all.map((d) => [d, d.open]));
    }
    if (active && changed) {
      for (const d of all) {
        const hasVisibleRow = Array.from(d.querySelectorAll(".problem-row"))
          .some((r) => !r.classList.contains("hidden"));
        if (hasVisibleRow) d.open = true;
      }
    }
    if (!active && snapshot.current) {
      snapshot.current.forEach((wasOpen, d) => { d.open = wasOpen; });
      snapshot.current = null;
    }
  }, [filters]);
}
```

Note the visibility test uses Tailwind's `hidden` class (the port's equivalent of deployed's `.filtered-out`).

**Acceptance:**
- Collapse all topics → type a search → matching topic/pattern auto-open → clear search → **every topic returns to collapsed**.
- Open two topics, collapse the rest → tick *Hide completed* → previously-collapsed topics **stay collapsed**.
- With *Hide completed* on, tick a question done → no accordion springs open.

### T2.2 — Analytics closed by default

`src/components/Analytics.tsx` renders `<details open>`; deployed (`ea95806:index.html:77`) has no `open` attribute. Remove `open`.

**Acceptance:** on first load the Analytics panel is collapsed; the ▸/▾ marker matches state.

---

## T3 — Add unit tests for the new logic

`src/store.test.ts` currently has 17 passing tests. Add:

- `areFiltersActive` returns true for each filter individually (incl. `reviseOnly`) and false for the default state.
- `isProblemVisible` matches on topic name, pattern name, subpattern and platform — not just question text (guards the widened search haystack).
- `isProblemVisible` respects `reviseOnly`.
- `buildHeatmapMonths`: a range spanning a month boundary splits days into the correct month blocks; `pad` equals the weekday of the first day in each block.
- `getHeatmapRange(0)` returns a trailing-365-day window labelled `Current`; `getHeatmapRange(1)` returns Jan 1–Dec 31 of last year.

The accordion behaviour in T2.1 is DOM-imperative and is covered by the manual checks in T4, not by unit tests.

**Acceptance:** `npx vitest run` green, no regressions in the existing 17.

---

## T4 — Full visual verification (the step that was interrupted)

Run `npm run dev`, and verify **every row in both light and dark**. This is the gate Phase 1B never actually passed.

| # | Check |
|---|---|
| 1 | Header: title, Export, Import, overall bar + `n/467 (x%)` |
| 2 | Undo import button appears only after an import/merge |
| 3 | Search box; Filters inline ≥700px, collapsed disclosure <700px |
| 4 | Difficulty pills incl. active inverted state |
| 5 | Importance + Interview-Freq selects |
| 6 | Hide-completed and **★ Revision only** checkboxes |
| 7 | Dashboard: Activity title, Continue →, ‹ / year label / › |
| 8 | Year nav disabled states at both ends |
| 9 | Stat tiles: day streak, solved today, in this range |
| 10 | Heatmap: month blocks, correct day placement, 5 levels, legend |
| 11 | Heatmap tooltip on **hover, keyboard focus, and tap**; Escape dismisses |
| 12 | Summary line `N solved · N revised on N active days in this range` |
| 13 | Analytics **collapsed by default**, expands correctly |
| 14 | Analytics cards + mini progress bars |
| 15 | Topic row: name, mini meter, `n/m` |
| 16 | Pattern row: name, `n/m`; markers correct per level |
| 17 | Question row: checkbox, strikethrough, badge, ★, notes |
| 18 | Notes indicator dot on questions with notes |
| 19 | Notes panel: meta line + textarea, commits **on blur only** |
| 20 | Continue → jumps, opens ancestors, flashes highlight |
| 21 | No-results message + Clear filters |
| 22 | Footer text + Advanced/merge disclosure |
| 23 | Sticky header on scroll |
| 24 | Focus-visible outlines on keyboard nav |
| 25 | **T2.1 accordion checks above** |

Also confirm: zero console errors in a production build (`npm run build && npx vite preview`) — dev-mode HMR websocket noise doesn't count.

---

## T5 — Data-safety verification

1. **Export a fresh backup from the deployed app before testing anything** (`ea95806` served locally, or the live site). The fixture in `~/Downloads/dsa-tracker-progress.json` predates the heatmap and has **no date fields**, so it only exercises the legacy path.
2. Load the React port with that fresh export in `localStorage` and confirm: overall count matches, `completedAt`/`revisedAt` survive, heatmap renders the same days, and the ID migration reports zero orphans.
3. Round-trip: Export → Import → counts and dates unchanged.
4. Merge: export from a second profile → merge → confirm union semantics (never un-solves, earliest date wins, notes concatenated) and that **Undo import** restores.
5. Confirm both localStorage keys survive: `dsa-tracker-progress` and `dsa-tracker-progress-backup`.

---

## T6 — Delete the vanilla app and land the work

Only after T4 and T5 pass.

1. Confirm `app.js`, `styles.css`, `data.js` are deleted from the tree (per the decision above); `data/questions.json` replaces `data.js`.
2. Confirm no references remain: search `src/` and `index.html` for `app.js`, `styles.css`, `data.js`.
3. Update `README.md` — it must describe the React/Vite stack **and** the deployed feature set (heatmap, streak, merge), not the stale vanilla description.
4. Commit on `feat/revision-system` in logical chunks (Phase 0 artifacts / React port / parity fixes). Do not merge to `main` until the user approves.

**Acceptance:** `npx tsc --noEmit`, `npx vitest run`, `npm run build` all clean; T4 checklist fully passed; `main` still serves the deployed vanilla app.

---

## Definition of done

- Every one of the 19 deployed behaviours works in the React port.
- T4's 25-row checklist passes in both themes.
- Real deployed progress loads with zero data loss and zero orphaned IDs.
- Phase 0 artifacts and `fundamentals.json` are byte-unchanged.
- Work is committed on `feat/revision-system`; `main` untouched.

**Then stop.** Phase 2 (IndexedDB + v2 schema) begins in `DSA_TRACKER_IMPLEMENTATION_PLAN.md`.

---

## Do not change without asking

- `data/idMap.json`, `data/idRegistry.json`, `data/questions.json`, `data/fundamentals.json`
- Either localStorage key
- `revisedAt` semantics (locked: ★ = bookmark)
- Visual appearance vs deployed — match it, don't "improve" it
- Dependencies beyond react, react-dom, zod, idb-keyval, vite, typescript, vitest, tailwindcss
