import { describe, expect, it } from "vitest";
import {
  areFiltersActive,
  buildHeatmapMonths,
  canCompleteFreely,
  computeStreak,
  countDone,
  countDoneInStoreV2,
  CURRENT_COMPLETION_GATE_VERSION,
  earlierDate,
  earliestYearOffset,
  ensureTopicsScheduled,
  getHeatmapRange,
  getTopicRevision,
  getV2Progress,
  hasCompletionEvidence,
  hasNotes,
  heatmapLevel,
  isProblemVisible,
  isValidStore,
  mergeNotes,
  mergeStores,
  migrateIdsIfNeeded,
  patchV2FromV1,
  remapIds,
  summarizeMerge,
  toExportableV2,
  v2ProgressToV1Store,
  v2Reducer,
} from "./store";
import { DEFAULT_SETTINGS, emptyAppStoreV2, isValidAppStoreV2, migrateV1ToV2 } from "./persistence/migrate";
import type { AppSettings, AppStoreV2, FilterState, Problem, ProblemState, ProgressStore, RevisionAttempt, Topic } from "./types";

function settings(patch: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

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

function v1StoreOf(id: string, entry: Partial<ProblemState>): ProgressStore {
  return { version: 1, idsMigrated: true, problems: { [id]: state(entry) } };
}

describe("patchV2FromV1 -- completion date semantics", () => {
  it("first completion sets both firstCompletedAt and lastCompletedAt", () => {
    const v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    expect(v2.progress.a.firstCompletedAt).toBe("2026-01-01");
    expect(v2.progress.a.lastCompletedAt).toBe("2026-01-01");
  });

  it("unchecking does not erase firstCompletedAt or lastCompletedAt", () => {
    let v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: false, completedAt: null }));
    expect(v2.progress.a.completed).toBe(false);
    expect(v2.progress.a.firstCompletedAt).toBe("2026-01-01");
    expect(v2.progress.a.lastCompletedAt).toBe("2026-01-01");
  });

  it("re-completing after an uncheck updates lastCompletedAt but never replaces firstCompletedAt", () => {
    let v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: false, completedAt: null }));
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-02-15" }));
    expect(v2.progress.a.firstCompletedAt).toBe("2026-01-01");
    expect(v2.progress.a.lastCompletedAt).toBe("2026-02-15");
  });

  it("survives multiple completion/uncompletion cycles without ever losing the original first date", () => {
    let v2 = emptyAppStoreV2();
    const cycles = [
      { done: true, completedAt: "2026-01-01" },
      { done: false, completedAt: null },
      { done: true, completedAt: "2026-02-01" },
      { done: false, completedAt: null },
      { done: true, completedAt: "2026-03-01" },
    ];
    for (const c of cycles) v2 = patchV2FromV1(v2, v1StoreOf("a", c));
    expect(v2.progress.a.firstCompletedAt).toBe("2026-01-01");
    expect(v2.progress.a.lastCompletedAt).toBe("2026-03-01");
    expect(v2.progress.a.completed).toBe(true);
  });

  it("a redundant re-patch of unchanged state does not disturb dates already recorded", () => {
    const v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    const before = v2.progress.a;
    const after = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    expect(after.progress.a).toEqual(before);
  });

  it("a migrated entry's original completion date survives later legacy uncheck/re-complete dispatches", () => {
    const migrated = migrateV1ToV2({ version: 1, idsMigrated: true, problems: { a: state({ done: true, completedAt: "2024-06-01" }) } });
    let v2 = patchV2FromV1(migrated, v1StoreOf("a", { done: false, completedAt: null }));
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-05-01" }));
    expect(v2.progress.a.firstCompletedAt).toBe("2024-06-01");
    expect(v2.progress.a.lastCompletedAt).toBe("2026-05-01");
  });
});

describe("v2Reducer -- v2-only fields are never clobbered by legacy v1 actions", () => {
  it("editing pseudocode survives a normal v1 action (toggling done)", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_PSEUDOCODE", id: "a", pseudocode: "for i in range(n): ..." });
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    expect(v2.progress.a.pseudocode).toBe("for i in range(n): ...");
    expect(v2.progress.a.completed).toBe(true);
  });

  it("editing code survives a normal v1 action", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_CODE", id: "a", code: "def solve(): pass" });
    v2 = patchV2FromV1(v2, v1StoreOf("a", { revise: true, revisedAt: "2026-01-01" }));
    expect(v2.progress.a.code).toBe("def solve(): pass");
    expect(v2.progress.a.starred).toBe(true);
  });

  it("structured notes survive a normal v1 action, alongside the legacy note it carries", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), {
      type: "SET_STRUCTURED_NOTE",
      id: "a",
      field: "keyInsight",
      value: "two pointers",
    });
    v2 = patchV2FromV1(v2, v1StoreOf("a", { notes: "legacy note" }));
    expect(v2.progress.a.notes.keyInsight).toBe("two pointers");
    expect(v2.progress.a.notes.legacy).toBe("legacy note");
  });

  it("mistakes survive a normal v1 action", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), {
      type: "ADD_MISTAKE",
      id: "a",
      mistake: { at: "2026-01-01", what: "off by one", remember: "check bounds" },
    });
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-01-02" }));
    expect(v2.progress.a.mistakes).toEqual([{ at: "2026-01-01", what: "off by one", remember: "check bounds" }]);
  });

  it("REMOVE_MISTAKE removes only the targeted entry", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "ADD_MISTAKE", id: "a", mistake: { at: "t1", what: "x", remember: "y" } });
    v2 = v2Reducer(v2, { type: "ADD_MISTAKE", id: "a", mistake: { at: "t2", what: "z", remember: "w" } });
    v2 = v2Reducer(v2, { type: "REMOVE_MISTAKE", id: "a", at: "t1" });
    expect(v2.progress.a.mistakes).toEqual([{ at: "t2", what: "z", remember: "w" }]);
  });

  it("existing v2 revisionStats survive legacy v1 actions", () => {
    const seeded: AppStoreV2 = {
      ...emptyAppStoreV2(),
      progress: {
        a: { ...getV2Progress(emptyAppStoreV2(), "a"), revisionStats: { count: 3, lastRevisedAt: "2026-01-01", lastScore: 90, lastConfidence: "strong" } },
      },
    };
    const v2 = patchV2FromV1(seeded, v1StoreOf("a", { done: true, completedAt: "2026-02-01" }));
    expect(v2.progress.a.revisionStats).toEqual({ count: 3, lastRevisedAt: "2026-01-01", lastScore: 90, lastConfidence: "strong" });
  });

  it("existing starred/starredAt behavior is unchanged by v2-native writes", () => {
    let v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { revise: true, revisedAt: "2026-01-01" }));
    v2 = v2Reducer(v2, { type: "SET_APPROACH", id: "a", approach: "two pointers" });
    expect(v2.progress.a.starred).toBe(true);
    expect(v2.progress.a.starredAt).toBe("2026-01-01");
    expect(v2.progress.a.approach).toBe("two pointers");
  });
});

describe("hasNotes", () => {
  it("is false when every note field, including legacy, is empty", () => {
    expect(hasNotes(getV2Progress(emptyAppStoreV2(), "a"))).toBe(false);
  });

  it("is true when only the legacy blob is non-empty (migrated notes keep their marker)", () => {
    const v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { notes: "old note" }));
    expect(hasNotes(v2.progress.a)).toBe(true);
  });

  it("is true when only a structured field is non-empty", () => {
    const v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_STRUCTURED_NOTE", id: "a", field: "keyInsight", value: "x" });
    expect(hasNotes(v2.progress.a)).toBe(true);
  });

  it("whitespace-only fields do not count as having notes", () => {
    const v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { notes: "   " }));
    expect(hasNotes(v2.progress.a)).toBe(false);
  });
});

describe("hasCompletionEvidence", () => {
  it("is false with empty pseudocode and code", () => {
    expect(hasCompletionEvidence(getV2Progress(emptyAppStoreV2(), "a"))).toBe(false);
  });

  it("is true with non-empty pseudocode alone", () => {
    const v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_PSEUDOCODE", id: "a", pseudocode: "for i in n: ..." });
    expect(hasCompletionEvidence(v2.progress.a)).toBe(true);
  });

  it("is true with non-empty code alone", () => {
    const v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_CODE", id: "a", code: "def f(): pass" });
    expect(hasCompletionEvidence(v2.progress.a)).toBe(true);
  });

  it("whitespace-only evidence does not count", () => {
    const v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_PSEUDOCODE", id: "a", pseudocode: "   " });
    expect(hasCompletionEvidence(v2.progress.a)).toBe(false);
  });
});

describe("canCompleteFreely -- the completion gate", () => {
  it("blocks a never-completed question with requireEvidence on and no evidence", () => {
    const progress = getV2Progress(emptyAppStoreV2(), "a");
    expect(canCompleteFreely(progress, settings({ requireEvidence: true }))).toBe(false);
  });

  it("allows it once pseudocode or code is present", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_PSEUDOCODE", id: "a", pseudocode: "two pointers" });
    expect(canCompleteFreely(v2.progress.a, settings({ requireEvidence: true }))).toBe(true);
    v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_CODE", id: "a", code: "..." });
    expect(canCompleteFreely(v2.progress.a, settings({ requireEvidence: true }))).toBe(true);
  });

  it("requireEvidence:false bypasses the gate entirely, evidence or not", () => {
    const progress = getV2Progress(emptyAppStoreV2(), "a");
    expect(canCompleteFreely(progress, settings({ requireEvidence: false }))).toBe(true);
  });

  it("a grandfathered/already-once-completed question is never re-gated, even with zero evidence", () => {
    let v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { done: true, completedAt: "2020-01-01" }));
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: false, completedAt: null })); // unchecked
    expect(v2.progress.a.firstCompletedAt).toBe("2020-01-01"); // still on record
    expect(hasCompletionEvidence(v2.progress.a)).toBe(false);
    expect(canCompleteFreely(v2.progress.a, settings({ requireEvidence: true }))).toBe(true);
  });
});

describe("completionGateVersion stamping on real completion", () => {
  it("stamps CURRENT_COMPLETION_GATE_VERSION when a genuinely new completion has evidence", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_PSEUDOCODE", id: "a", pseudocode: "two pointers" });
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    expect(v2.progress.a.completionGateVersion).toBe(CURRENT_COMPLETION_GATE_VERSION);
  });

  it("stays null when requireEvidence bypassed it (no evidence, new completion)", () => {
    const v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { done: true, completedAt: "2026-01-01" }));
    expect(v2.progress.a.completionGateVersion).toBeNull();
  });

  it("a migrated/grandfathered completion is version null, not the current gate version", () => {
    const v2 = migrateV1ToV2({ version: 1, idsMigrated: true, problems: { a: state({ done: true, completedAt: "2020-01-01" }) } });
    expect(v2.progress.a.completionGateVersion).toBeNull();
  });

  it("re-completing after an uncheck stays null even with evidence present -- re-checks are exempt, not re-verified", () => {
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_PSEUDOCODE", id: "a", pseudocode: "two pointers" });
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-01-01" })); // gated pass
    expect(v2.progress.a.completionGateVersion).toBe(CURRENT_COMPLETION_GATE_VERSION);
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: false, completedAt: null })); // uncheck
    v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, completedAt: "2026-02-01" })); // re-check
    expect(v2.progress.a.completionGateVersion).toBeNull();
  });
});

describe("Phase 3 acceptance: legacy notes survive an edit to another field, byte-identical", () => {
  it("editing a structured note field does not alter the legacy blob", () => {
    let v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { notes: "original legacy note, verbatim" }));
    v2 = v2Reducer(v2, { type: "SET_STRUCTURED_NOTE", id: "a", field: "commonMistake", value: "off by one" });
    expect(v2.progress.a.notes.legacy).toBe("original legacy note, verbatim");
    expect(v2.progress.a.notes.commonMistake).toBe("off by one");
  });

  it("editing pseudocode/code/approach does not alter the legacy blob", () => {
    let v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { notes: "original legacy note, verbatim" }));
    v2 = v2Reducer(v2, { type: "SET_PSEUDOCODE", id: "a", pseudocode: "..." });
    v2 = v2Reducer(v2, { type: "SET_CODE", id: "a", code: "..." });
    v2 = v2Reducer(v2, { type: "SET_APPROACH", id: "a", approach: "..." });
    expect(v2.progress.a.notes.legacy).toBe("original legacy note, verbatim");
  });
});

// --- Phase 3 remediation: export/backup must carry the full v2 store -------

function richV2(): AppStoreV2 {
  let v2 = v2Reducer(emptyAppStoreV2(), { type: "SET_APPROACH", id: "a", approach: "two pointers" });
  v2 = v2Reducer(v2, { type: "SET_PSEUDOCODE", id: "a", pseudocode: "for i in range(n): ..." });
  v2 = v2Reducer(v2, { type: "SET_CODE", id: "a", code: "def solve(): pass" });
  v2 = v2Reducer(v2, { type: "SET_STRUCTURED_NOTE", id: "a", field: "keyInsight", value: "hash map lookup" });
  v2 = v2Reducer(v2, { type: "ADD_MISTAKE", id: "a", mistake: { at: "2026-01-01T00:00:00.000Z", what: "off by one", remember: "check bounds" } });
  v2 = patchV2FromV1(v2, v1StoreOf("a", { done: true, revise: true, notes: "legacy note", completedAt: "2026-01-01", revisedAt: "2026-01-02" }));
  return v2;
}

describe("toExportableV2", () => {
  it("strips the API key but preserves everything else", () => {
    const v2 = { ...richV2(), settings: { ...emptyAppStoreV2().settings, apiKey: "secret-key-value" } };
    const exportable = toExportableV2(v2);
    expect(exportable.settings.apiKey).toBe("");
    expect(exportable.progress).toEqual(v2.progress);
    expect(exportable.schemaVersion).toBe(2);
  });

  it("preserves approach/pseudocode/code/structured notes/mistakes/dates/star/gate version", () => {
    const v2 = richV2();
    const exportable = toExportableV2(v2);
    const a = exportable.progress.a;
    expect(a.approach).toBe("two pointers");
    expect(a.pseudocode).toBe("for i in range(n): ...");
    expect(a.code).toBe("def solve(): pass");
    expect(a.notes.keyInsight).toBe("hash map lookup");
    expect(a.notes.legacy).toBe("legacy note");
    expect(a.mistakes).toEqual([{ at: "2026-01-01T00:00:00.000Z", what: "off by one", remember: "check bounds" }]);
    expect(a.starred).toBe(true);
    expect(a.starredAt).toBe("2026-01-02");
    expect(a.firstCompletedAt).toBe("2026-01-01");
    expect(a.completed).toBe(true);
  });

  it("preserves revisionStats and orphanedProgress even though nothing writes to them yet", () => {
    const v2 = richV2();
    v2.progress.a.revisionStats = { count: 2, lastRevisedAt: "2026-02-01", lastScore: 80, lastConfidence: "strong" };
    v2.orphanedProgress.orphan1 = getV2Progress(emptyAppStoreV2(), "orphan1");
    const exportable = toExportableV2(v2);
    expect(exportable.progress.a.revisionStats).toEqual({ count: 2, lastRevisedAt: "2026-02-01", lastScore: 80, lastConfidence: "strong" });
    expect(exportable.orphanedProgress.orphan1).toBeDefined();
  });
});

describe("countDoneInStoreV2", () => {
  it("counts completed entries", () => {
    let v2 = patchV2FromV1(emptyAppStoreV2(), v1StoreOf("a", { done: true }));
    v2 = patchV2FromV1(v2, v1StoreOf("b", { done: false }));
    expect(countDoneInStoreV2(v2)).toBe(1);
  });

  it("is zero for an empty store", () => {
    expect(countDoneInStoreV2(emptyAppStoreV2())).toBe(0);
  });
});

describe("v2Reducer -- REPLACE_STORE", () => {
  it("replaces the entire store wholesale", () => {
    const incoming = richV2();
    const result = v2Reducer(emptyAppStoreV2(), { type: "REPLACE_STORE", store: incoming });
    expect(result).toBe(incoming);
  });
});

describe("v1/v2 shape detection is mutually exclusive (import auto-detection)", () => {
  it("a v1 ProgressStore is never mistaken for a v2 AppStoreV2", () => {
    const v1: ProgressStore = { version: 1, idsMigrated: true, problems: { a: state({ done: true }) } };
    expect(isValidAppStoreV2(v1)).toBe(false);
    expect(isValidStore(v1)).toBe(true);
  });

  it("a v2 AppStoreV2 is never mistaken for a v1 ProgressStore", () => {
    const v2 = richV2();
    expect(isValidStore(v2)).toBe(false);
    expect(isValidAppStoreV2(v2)).toBe(true);
  });
});

describe("Phase 3 remediation: importing a full v2 export round-trips losslessly", () => {
  it("REPLACE_STORE followed by the matching v1 sync (patchV2FromV1) never disturbs any v2-only field", () => {
    // Mirrors exactly what ImportExport.tsx's handleImport does for a v2 file:
    // dispatchV2(REPLACE_STORE) followed by dispatch(IMPORT, v2ProgressToV1Store(...)),
    // which is what fires the existing [store]-driven sync effect in a real app.
    const imported = richV2();
    const afterReplace = v2Reducer(emptyAppStoreV2(), { type: "REPLACE_STORE", store: imported });
    const v1View = v2ProgressToV1Store(afterReplace);
    const afterSync = patchV2FromV1(afterReplace, v1View);

    expect(afterSync).toEqual(imported);
  });

  it("also round-trips correctly for an entry that was never completed", () => {
    let imported = v2Reducer(emptyAppStoreV2(), { type: "SET_PSEUDOCODE", id: "b", pseudocode: "draft only" });
    const afterReplace = v2Reducer(emptyAppStoreV2(), { type: "REPLACE_STORE", store: imported });
    const v1View = v2ProgressToV1Store(afterReplace);
    const afterSync = patchV2FromV1(afterReplace, v1View);
    expect(afterSync).toEqual(imported);
  });
});

// --- Phase 6: revision session lifecycle ------------------------------------

function topicFixture(id: string, problemIds: string[]): Topic {
  return { id, name: id, patterns: [{ id: `${id}__p1`, name: "P1", problems: problemIds.map((pid) => problem({ id: pid })) }] };
}

function completeIn(v2: AppStoreV2, ids: string[]): AppStoreV2 {
  let next = v2;
  for (const id of ids) next = patchV2FromV1(next, v1StoreOf(id, { done: true }));
  return next;
}

function attemptFixture(patch: Partial<RevisionAttempt> = {}): RevisionAttempt {
  return {
    id: "att1",
    topicId: "arrays",
    startedAt: "2026-01-01T00:00:00.000Z",
    submittedAt: null,
    fundamentals: [{ conceptId: "c1", answer: "" }],
    questions: [{ questionId: "q1", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: null }],
    evaluationStatus: "DRAFT",
    evaluation: null,
    error: null,
    ...patch,
  };
}

describe("getTopicRevision", () => {
  it("returns a sensible default when a topic has never been scheduled", () => {
    const tr = getTopicRevision(emptyAppStoreV2(), "arrays");
    expect(tr).toEqual({
      topicId: "arrays",
      cycle: 0,
      nextDueAt: null,
      lastPassedAt: null,
      lastFailedAt: null,
      activeSessionId: null,
      history: [],
      weakConcepts: {},
    });
  });

  it("returns the real entry once one exists", () => {
    const v2 = ensureTopicsScheduled(completeIn(emptyAppStoreV2(), ["a", "b", "c", "d"]), [topicFixture("arrays", ["a", "b", "c", "d"])]);
    expect(getTopicRevision(v2, "arrays").nextDueAt).not.toBeNull();
  });
});

describe("ensureTopicsScheduled", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("schedules a topic the moment completion crosses the threshold", () => {
    const topic = topicFixture("arrays", ["a", "b", "c", "d"]); // 3/4 = 75%
    const v2 = ensureTopicsScheduled(completeIn(emptyAppStoreV2(), ["a", "b", "c"]), [topic], now);
    const tr = v2.revision.arrays;
    expect(tr).toBeDefined();
    expect(tr.cycle).toBe(0);
    expect(tr.nextDueAt).not.toBeNull();
    expect(tr.nextDueAt! > "2026-01-01").toBe(true); // a real grace period, not immediately due
  });

  it("does not schedule a topic below the threshold", () => {
    const topic = topicFixture("arrays", ["a", "b", "c", "d"]); // 1/4 = 25%
    const v2 = ensureTopicsScheduled(completeIn(emptyAppStoreV2(), ["a"]), [topic], now);
    expect(v2.revision.arrays).toBeUndefined();
  });

  it("never schedules an exempt topic even at 100%", () => {
    const topic = topicFixture("fundamentals", ["a", "b"]);
    const v2 = ensureTopicsScheduled(completeIn(emptyAppStoreV2(), ["a", "b"]), [topic], now);
    expect(v2.revision.fundamentals).toBeUndefined();
  });

  it("never overwrites an existing entry, even one that would look eligible again", () => {
    const topic = topicFixture("arrays", ["a", "b", "c", "d"]);
    const seeded: AppStoreV2 = {
      ...completeIn(emptyAppStoreV2(), ["a", "b", "c", "d"]),
      revision: { arrays: { topicId: "arrays", cycle: 2, nextDueAt: "2020-01-01", lastPassedAt: "2020-01-01", lastFailedAt: null, activeSessionId: null, history: [], weakConcepts: { x: 1 } } },
    };
    const v2 = ensureTopicsScheduled(seeded, [topic], now);
    expect(v2.revision.arrays).toEqual(seeded.revision.arrays); // untouched, not re-scheduled
  });

  it("is a no-op (same reference) when nothing needs scheduling", () => {
    const v2 = emptyAppStoreV2();
    expect(ensureTopicsScheduled(v2, [topicFixture("arrays", ["a"])], now)).toBe(v2);
  });
});

describe("v2Reducer -- revision session lifecycle", () => {
  it("START_REVISION_SESSION stores the attempt and marks the topic active", () => {
    const attempt = attemptFixture();
    const v2 = v2Reducer(emptyAppStoreV2(), { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
    expect(v2.attempts.att1).toEqual(attempt);
    expect(v2.revision.arrays.activeSessionId).toBe("att1");
  });

  it("START_REVISION_SESSION preserves an existing topic revision's history/cycle", () => {
    const seeded: AppStoreV2 = {
      ...emptyAppStoreV2(),
      revision: { arrays: { topicId: "arrays", cycle: 2, nextDueAt: "2026-06-01", lastPassedAt: "2026-01-01", lastFailedAt: null, activeSessionId: null, history: [{ at: "2026-01-01", score: 90, passed: true, attemptId: "old" }], weakConcepts: {} } },
    };
    const v2 = v2Reducer(seeded, { type: "START_REVISION_SESSION", topicId: "arrays", attempt: attemptFixture() });
    expect(v2.revision.arrays.cycle).toBe(2);
    expect(v2.revision.arrays.history).toHaveLength(1);
    expect(v2.revision.arrays.activeSessionId).toBe("att1");
  });

  it("SAVE_FUNDAMENTAL_ANSWER updates only the matching concept", () => {
    const attempt = attemptFixture({ fundamentals: [{ conceptId: "c1", answer: "" }, { conceptId: "c2", answer: "" }] });
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
    v2 = v2Reducer(v2, { type: "SAVE_FUNDAMENTAL_ANSWER", attemptId: "att1", conceptId: "c2", answer: "because X" });
    expect(v2.attempts.att1.fundamentals).toEqual([
      { conceptId: "c1", answer: "" },
      { conceptId: "c2", answer: "because X" },
    ]);
  });

  it("SAVE_FUNDAMENTAL_ANSWER is a no-op for an unknown attempt id", () => {
    const v2 = emptyAppStoreV2();
    expect(v2Reducer(v2, { type: "SAVE_FUNDAMENTAL_ANSWER", attemptId: "nope", conceptId: "c1", answer: "x" })).toBe(v2);
  });

  it("SAVE_QUESTION_RECALL updates only the targeted field on the targeted question", () => {
    const attempt = attemptFixture({
      questions: [
        { questionId: "q1", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: null },
        { questionId: "q2", approach: "keep me", pseudocode: "", complexity: "", edgeCases: "", confidence: null },
      ],
    });
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
    v2 = v2Reducer(v2, { type: "SAVE_QUESTION_RECALL", attemptId: "att1", questionId: "q1", field: "pseudocode", value: "loop it" });
    expect(v2.attempts.att1.questions[0]).toEqual({ questionId: "q1", approach: "", pseudocode: "loop it", complexity: "", edgeCases: "", confidence: null });
    expect(v2.attempts.att1.questions[1].approach).toBe("keep me"); // untouched
  });

  it("SAVE_QUESTION_CONFIDENCE sets confidence on the targeted question only", () => {
    const attempt = attemptFixture({
      questions: [
        { questionId: "q1", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: null },
        { questionId: "q2", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: null },
      ],
    });
    let v2 = v2Reducer(emptyAppStoreV2(), { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
    v2 = v2Reducer(v2, { type: "SAVE_QUESTION_CONFIDENCE", attemptId: "att1", questionId: "q2", confidence: "forgot" });
    expect(v2.attempts.att1.questions[0].confidence).toBeNull();
    expect(v2.attempts.att1.questions[1].confidence).toBe("forgot");
  });

  describe("SUBMIT_REVISION_SESSION", () => {
    it("marks the attempt submitted/PENDING and clears activeSessionId, without touching cycle/history", () => {
      const attempt = attemptFixture({ questions: [{ questionId: "q1", approach: "a", pseudocode: "p", complexity: "c", edgeCases: "", confidence: "strong" }] });
      let v2 = v2Reducer(emptyAppStoreV2(), { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
      v2 = v2Reducer(v2, { type: "SUBMIT_REVISION_SESSION", attemptId: "att1" });

      expect(v2.attempts.att1.submittedAt).not.toBeNull();
      expect(v2.attempts.att1.evaluationStatus).toBe("PENDING");
      expect(v2.attempts.att1.evaluation).toBeNull();
      expect(v2.revision.arrays.activeSessionId).toBeNull();
      expect(v2.revision.arrays.cycle).toBe(0); // no LLM yet -- no pass/fail, no interval advance
      expect(v2.revision.arrays.history).toEqual([]);
    });

    it("records revisionStats (count/lastRevisedAt/lastConfidence) for every rated question", () => {
      const attempt = attemptFixture({ questions: [{ questionId: "q1", approach: "a", pseudocode: "p", complexity: "c", edgeCases: "", confidence: "partial" }] });
      let v2 = v2Reducer(emptyAppStoreV2(), { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
      v2 = v2Reducer(v2, { type: "SUBMIT_REVISION_SESSION", attemptId: "att1" });

      const stats = v2.progress.q1.revisionStats;
      expect(stats.count).toBe(1);
      expect(stats.lastRevisedAt).not.toBeNull();
      expect(stats.lastConfidence).toBe("partial");
      expect(stats.lastScore).toBeNull(); // never fabricated -- only a real LLM evaluation sets this (Phase 7)
    });

    it("increments an existing revisionStats.count rather than resetting it", () => {
      let v2 = emptyAppStoreV2();
      v2 = { ...v2, progress: { ...v2.progress, q1: { ...getV2Progress(v2, "q1"), revisionStats: { count: 3, lastRevisedAt: "2025-01-01", lastScore: 60, lastConfidence: "forgot" } } } };
      const attempt = attemptFixture({ questions: [{ questionId: "q1", approach: "a", pseudocode: "p", complexity: "c", edgeCases: "", confidence: "strong" }] });
      v2 = v2Reducer(v2, { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
      v2 = v2Reducer(v2, { type: "SUBMIT_REVISION_SESSION", attemptId: "att1" });
      expect(v2.progress.q1.revisionStats.count).toBe(4);
      expect(v2.progress.q1.revisionStats.lastScore).toBe(60); // untouched -- no new score exists to replace it with
    });

    it("skips a question left with no confidence rating rather than crashing", () => {
      const attempt = attemptFixture({ questions: [{ questionId: "q1", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: null }] });
      let v2 = v2Reducer(emptyAppStoreV2(), { type: "START_REVISION_SESSION", topicId: "arrays", attempt });
      v2 = v2Reducer(v2, { type: "SUBMIT_REVISION_SESSION", attemptId: "att1" });
      expect(v2.progress.q1).toBeUndefined();
    });

    it("is a no-op for an unknown attempt id", () => {
      const v2 = emptyAppStoreV2();
      expect(v2Reducer(v2, { type: "SUBMIT_REVISION_SESSION", attemptId: "nope" })).toBe(v2);
    });
  });
});
