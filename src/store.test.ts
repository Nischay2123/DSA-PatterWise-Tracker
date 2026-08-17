import { describe, expect, it } from "vitest";
import {
  areFiltersActive,
  buildHeatmapMonths,
  computeStreak,
  countDone,
  earlierDate,
  earliestYearOffset,
  getHeatmapRange,
  heatmapLevel,
  isProblemVisible,
  isValidStore,
  mergeNotes,
  mergeStores,
  migrateIdsIfNeeded,
  remapIds,
  summarizeMerge,
} from "./store";
import type { FilterState, Problem, ProblemState, ProgressStore } from "./types";

function state(patch: Partial<ProblemState> = {}): ProblemState {
  return { done: false, revise: false, notes: "", completedAt: null, revisedAt: null, ...patch };
}

function filters(patch: Partial<FilterState> = {}): FilterState {
  return { search: "", difficulty: "All", importance: "All", freq: "All", hideCompleted: false, reviseOnly: false, ...patch };
}

function problem(patch: Partial<Problem> = {}): Problem {
  return {
    id: "p1",
    subpattern: "",
    question: "Reverse a Linked List",
    platform: "LeetCode",
    link: null,
    difficulty: "Easy",
    originalStep: "",
    estMinutes: "",
    importance: "High",
    interviewFreq: "High",
    ...patch,
  };
}

describe("countDone", () => {
  it("counts only done problems present in the store", () => {
    const fixture = [{ id: "x1" }, { id: "x2" }, { id: "x3" }];
    const store = { problems: { x1: state({ done: true }), x3: state({ done: true }) } } as unknown as ProgressStore;
    expect(countDone(fixture, store)).toBe(2);
  });
});

describe("remapIds", () => {
  const idMap = { p1: "arrays__two-pointers__foo", p2: "arrays__two-pointers__bar" };

  it("maps known old ids to their new stable id, preserving state", () => {
    const { migrated } = remapIds({ p1: state({ done: true }) }, idMap);
    expect(migrated["arrays__two-pointers__foo"]).toEqual(state({ done: true }));
  });

  it("preserves unmapped ids instead of dropping them, and reports them as orphaned", () => {
    const { migrated, orphaned } = remapIds({ p3: state({ done: true }) }, idMap);
    expect(migrated.p3).toEqual(state({ done: true }));
    expect(orphaned).toEqual(["p3"]);
  });

  it("never loses or duplicates entries", () => {
    const input = { p1: state({ done: true }), p3: state({ revise: true, notes: "x" }) };
    const { migrated } = remapIds(input, idMap);
    expect(Object.keys(migrated)).toHaveLength(2);
  });
});

describe("migrateIdsIfNeeded", () => {
  it("is a no-op once idsMigrated is already set", () => {
    const store: ProgressStore = { version: 1, problems: { p1: state({ done: true }) }, idsMigrated: true };
    const result = migrateIdsIfNeeded(store);
    expect(result.migrated).toBe(false);
    expect(result.store).toBe(store);
  });
});

describe("isValidStore", () => {
  it("accepts a well-formed store", () => {
    expect(isValidStore({ version: 1, problems: {} })).toBe(true);
  });
  it("rejects null, arrays, and objects without a problems map", () => {
    expect(isValidStore(null)).toBe(false);
    expect(isValidStore([])).toBe(false);
    expect(isValidStore({ version: 1 })).toBe(false);
    expect(isValidStore({ problems: [] })).toBe(false);
  });
});

describe("heatmapLevel", () => {
  it("buckets counts into fixed thresholds, not relative to a range max", () => {
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(1)).toBe(1);
    expect(heatmapLevel(2)).toBe(1);
    expect(heatmapLevel(3)).toBe(2);
    expect(heatmapLevel(5)).toBe(2);
    expect(heatmapLevel(6)).toBe(3);
    expect(heatmapLevel(9)).toBe(3);
    expect(heatmapLevel(10)).toBe(4);
    expect(heatmapLevel(100)).toBe(4);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const now = new Date(2026, 0, 10); // Jan 10, 2026
    const doneByDate = new Map([
      ["2026-01-10", 1],
      ["2026-01-09", 2],
      ["2026-01-08", 1],
      ["2026-01-06", 1], // gap on the 7th breaks the streak here
    ]);
    expect(computeStreak(doneByDate, now)).toBe(3);
  });

  it("stays alive through today even before anything is solved today", () => {
    const now = new Date(2026, 0, 10);
    const doneByDate = new Map([["2026-01-09", 1]]);
    expect(computeStreak(doneByDate, now)).toBe(1);
  });

  it("is zero once a full day has passed with nothing solved", () => {
    const now = new Date(2026, 0, 10);
    const doneByDate = new Map([["2026-01-08", 1]]);
    expect(computeStreak(doneByDate, now)).toBe(0);
  });
});

describe("earliestYearOffset", () => {
  it("computes how many years back the earliest record goes", () => {
    const now = new Date(2026, 0, 1);
    const store = {
      version: 1,
      problems: { a: state({ completedAt: "2024-06-01" }), b: state({ revisedAt: "2025-01-01" }) },
    } as ProgressStore;
    expect(earliestYearOffset(store, now)).toBe(2);
  });

  it("is zero when there's no history at all", () => {
    const store = { version: 1, problems: {} } as ProgressStore;
    expect(earliestYearOffset(store)).toBe(0);
  });
});

describe("merge", () => {
  it("earlierDate picks the lexically-smaller (earlier) ISO date", () => {
    expect(earlierDate("2024-01-01", "2023-01-01")).toBe("2023-01-01");
    expect(earlierDate(null, "2023-01-01")).toBe("2023-01-01");
    expect(earlierDate(null, null)).toBeNull();
  });

  it("mergeNotes concatenates differing notes and dedupes identical ones", () => {
    expect(mergeNotes("", "b")).toBe("b");
    expect(mergeNotes("a", "")).toBe("a");
    expect(mergeNotes("same", "same")).toBe("same");
    expect(mergeNotes("a", "b")).toBe("a\n\n--- merged ---\n\nb");
  });

  it("mergeStores is a union: solved-in-either wins, never un-solves", () => {
    const local: ProgressStore = {
      version: 1,
      problems: { a: state({ done: true, completedAt: "2024-02-01" }), b: state({ done: false }) },
    };
    const incoming: ProgressStore = {
      version: 1,
      problems: { a: state({ done: true, completedAt: "2024-01-01" }), b: state({ done: true, completedAt: "2024-03-01" }) },
    };
    const merged = mergeStores(local, incoming);
    expect(merged.problems.a.done).toBe(true);
    expect(merged.problems.a.completedAt).toBe("2024-01-01"); // earlier of the two wins
    expect(merged.problems.b.done).toBe(true); // union: incoming solved it, so merged must too
  });

  it("summarizeMerge reports exactly what changed relative to local", () => {
    const local: ProgressStore = { version: 1, problems: { a: state({ done: false }) } };
    const merged: ProgressStore = { version: 1, problems: { a: state({ done: true, notes: "x" }) } };
    expect(summarizeMerge(local, merged)).toEqual({ newlySolved: 1, newlyRevised: 0, notesCombined: 1 });
  });
});

describe("areFiltersActive", () => {
  it("is false for the default filter state", () => {
    expect(areFiltersActive(filters())).toBe(false);
  });

  it("is true when any single filter deviates from default", () => {
    expect(areFiltersActive(filters({ search: "two sum" }))).toBe(true);
    expect(areFiltersActive(filters({ difficulty: "Hard" }))).toBe(true);
    expect(areFiltersActive(filters({ importance: "High" }))).toBe(true);
    expect(areFiltersActive(filters({ freq: "Very High" }))).toBe(true);
    expect(areFiltersActive(filters({ reviseOnly: true }))).toBe(true);
  });

  it("hideCompleted alone does not count as an active filter (matches deployed)", () => {
    expect(areFiltersActive(filters({ hideCompleted: true }))).toBe(false);
  });

  it("whitespace-only search is not active", () => {
    expect(areFiltersActive(filters({ search: "   " }))).toBe(false);
  });
});

describe("isProblemVisible", () => {
  const ctx = { topicName: "Linked List", patternName: "Reverse" };

  it("matches on the question text", () => {
    const p = problem({ question: "Reverse a Linked List" });
    expect(isProblemVisible(p, state(), filters({ search: "reverse" }), ctx)).toBe(true);
  });

  it("matches on topic name even when absent from the question text", () => {
    const p = problem({ question: "Detect Cycle" });
    expect(isProblemVisible(p, state(), filters({ search: "linked list" }), ctx)).toBe(true);
  });

  it("matches on pattern name", () => {
    const p = problem({ question: "Detect Cycle" });
    expect(isProblemVisible(p, state(), filters({ search: "reverse" }), ctx)).toBe(true);
  });

  it("matches on subpattern and platform", () => {
    const p = problem({ question: "Detect Cycle", subpattern: "Floyd's Algorithm", platform: "GeeksforGeeks" });
    expect(isProblemVisible(p, state(), filters({ search: "floyd" }), ctx)).toBe(true);
    expect(isProblemVisible(p, state(), filters({ search: "geeksforgeeks" }), ctx)).toBe(true);
  });

  it("a non-matching search excludes the problem", () => {
    const p = problem({ question: "Detect Cycle" });
    expect(isProblemVisible(p, state(), filters({ search: "binary search" }), ctx)).toBe(false);
  });

  it("reviseOnly hides problems that are not starred", () => {
    const p = problem();
    expect(isProblemVisible(p, state({ revise: false }), filters({ reviseOnly: true }), ctx)).toBe(false);
    expect(isProblemVisible(p, state({ revise: true }), filters({ reviseOnly: true }), ctx)).toBe(true);
  });
});

describe("getHeatmapRange", () => {
  it("offset 0 is a trailing 365-day window ending today, labelled Current", () => {
    const now = new Date(2026, 5, 15);
    const range = getHeatmapRange(0, now);
    expect(range.label).toBe("Current");
    expect(range.end.getTime()).toBe(new Date(2026, 5, 15).getTime());
    expect(range.start.getTime()).toBe(new Date(2025, 5, 16).getTime());
  });

  it("offset 1 is Jan 1 - Dec 31 of last year", () => {
    const now = new Date(2026, 5, 15);
    const range = getHeatmapRange(1, now);
    expect(range.label).toBe("2025");
    expect(range.start.getTime()).toBe(new Date(2025, 0, 1).getTime());
    expect(range.end.getTime()).toBe(new Date(2025, 11, 31).getTime());
  });
});

describe("buildHeatmapMonths", () => {
  it("splits a week straddling a month boundary into two correctly-owned month blocks", () => {
    const range = { start: new Date(2026, 0, 28), end: new Date(2026, 1, 3), label: "test" };
    const months = buildHeatmapMonths(new Map(), new Map(), range);

    expect(months).toHaveLength(2);
    expect(months[0].label).toBe("Jan");
    expect(months[0].days).toHaveLength(4); // 28, 29, 30, 31
    expect(months[0].days[0].date.getDate()).toBe(28);
    expect(months[0].days[months[0].days.length - 1].date.getDate()).toBe(31);
    expect(months[0].pad).toBe(new Date(2026, 0, 28).getDay());

    expect(months[1].label).toBe("Feb");
    expect(months[1].days).toHaveLength(3); // 1, 2, 3
    expect(months[1].days[0].date.getDate()).toBe(1);
    expect(months[1].pad).toBe(new Date(2026, 1, 1).getDay());
  });

  it("carries done/revised counts through to the matching day", () => {
    const range = { start: new Date(2026, 0, 1), end: new Date(2026, 0, 3), label: "test" };
    const doneByDate = new Map([["2026-01-02", 4]]);
    const revisedByDate = new Map([["2026-01-02", 1]]);
    const months = buildHeatmapMonths(doneByDate, revisedByDate, range);
    const day2 = months[0].days.find((d) => d.date.getDate() === 2)!;
    expect(day2.done).toBe(4);
    expect(day2.revised).toBe(1);
  });
});
