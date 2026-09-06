import { describe, expect, it } from "vitest";
import { areFiltersActive, earlierDate, isProblemVisible, mergeStores, mergeStoresV2 } from "./store";
import { emptyAppStoreV2 } from "./persistence/migrate";
import type { AppStoreV2, FilterState, Problem, ProblemState, QuestionProgressV2, TopicRevision } from "./types";

function problem(patch: Partial<Problem> = {}): Problem {
  return {
    id: "p1", subpattern: "", question: "Two Sum", platform: "LeetCode", link: null,
    difficulty: "Easy", originalStep: "", estMinutes: "", importance: "High", interviewFreq: "High",
    ...patch,
  };
}
function state(patch: Partial<ProblemState> = {}): ProblemState {
  return { done: false, revise: false, notes: "", completedAt: null, revisedAt: null, ...patch };
}
function filters(patch: Partial<FilterState> = {}): FilterState {
  return { search: "", difficulty: "All", importance: "All", freq: "All", hideCompleted: false, reviseOnly: false, ...patch };
}
const CTX = { topicName: "Arrays", patternName: "Hashing" };

describe("isProblemVisible -- the goal-only filter", () => {
  const SPRINT = { minFreq: "High" as const, difficulties: ["Easy", "Medium", "Hard"] as const };
  const goalCtx = { ...CTX, goal: { ...SPRINT, difficulties: [...SPRINT.difficulties] } };

  it("keeps a problem the goal counts", () => {
    const p = problem({ interviewFreq: "Very High" });
    expect(isProblemVisible(p, state(), filters({ goalOnly: true }), goalCtx)).toBe(true);
  });

  it("hides a problem the goal does not count", () => {
    const p = problem({ interviewFreq: "Low" });
    expect(isProblemVisible(p, state(), filters({ goalOnly: true }), goalCtx)).toBe(false);
    // ...and shows it again the moment the toggle is off.
    expect(isProblemVisible(p, state(), filters({ goalOnly: false }), goalCtx)).toBe(true);
  });

  it("hides nothing when the context carries no goal, so a caller that forgets one cannot blank the list", () => {
    const p = problem({ interviewFreq: "Low" });
    expect(isProblemVisible(p, state(), filters({ goalOnly: true }), CTX)).toBe(true);
  });

  it("counts as an active filter, so the accordions force open for it", () => {
    expect(areFiltersActive(filters())).toBe(false);
    expect(areFiltersActive(filters({ goalOnly: true }))).toBe(true);
  });
});

describe("isProblemVisible -- each filter rejects independently", () => {
  it("hides a problem whose difficulty doesn't match", () => {
    expect(isProblemVisible(problem({ difficulty: "Easy" }), state(), filters({ difficulty: "Hard" }), CTX)).toBe(false);
    expect(isProblemVisible(problem({ difficulty: "Hard" }), state(), filters({ difficulty: "Hard" }), CTX)).toBe(true);
  });

  it("hides a problem whose importance doesn't match", () => {
    expect(isProblemVisible(problem({ importance: "Low" }), state(), filters({ importance: "High" }), CTX)).toBe(false);
    expect(isProblemVisible(problem({ importance: "High" }), state(), filters({ importance: "High" }), CTX)).toBe(true);
  });

  it("hides a problem whose interview frequency doesn't match", () => {
    expect(isProblemVisible(problem({ interviewFreq: "Low" }), state(), filters({ freq: "Very High" }), CTX)).toBe(false);
    expect(isProblemVisible(problem({ interviewFreq: "Very High" }), state(), filters({ freq: "Very High" }), CTX)).toBe(true);
  });

  it("hideCompleted hides done problems only", () => {
    expect(isProblemVisible(problem(), state({ done: true }), filters({ hideCompleted: true }), CTX)).toBe(false);
    expect(isProblemVisible(problem(), state({ done: false }), filters({ hideCompleted: true }), CTX)).toBe(true);
  });

  it("reviseOnly shows starred problems only", () => {
    expect(isProblemVisible(problem(), state({ revise: false }), filters({ reviseOnly: true }), CTX)).toBe(false);
    expect(isProblemVisible(problem(), state({ revise: true }), filters({ reviseOnly: true }), CTX)).toBe(true);
  });

  it("search matches the topic and pattern names, not just the question", () => {
    expect(isProblemVisible(problem(), state(), filters({ search: "hashing" }), CTX)).toBe(true);
    expect(isProblemVisible(problem(), state(), filters({ search: "arrays" }), CTX)).toBe(true);
    expect(isProblemVisible(problem(), state(), filters({ search: "graphs" }), CTX)).toBe(false);
  });

  it("tolerates a problem with empty metadata fields", () => {
    expect(isProblemVisible(problem({ platform: "", subpattern: "" }), state(), filters({ search: "two" }), CTX)).toBe(true);
  });
});

describe("earlierDate / v1 merge date invariants", () => {
  it("returns null only when both sides are null", () => {
    expect(earlierDate("2026-01-01", null)).toBe("2026-01-01");
    expect(earlierDate(null, "2026-01-01")).toBe("2026-01-01");
    expect(earlierDate(null, null)).toBeNull();
  });

  it("never keeps a date without its flag", () => {
    const merged = mergeStores(
      { version: 1, problems: { a: state({ done: false, completedAt: "2026-01-01", revise: false, revisedAt: "2026-01-02" }) } },
      { version: 1, problems: {} }
    );
    // done/revise are false, so the dates must be cleared to preserve the
    // invariant the rest of the app relies on.
    expect(merged.problems.a.completedAt).toBeNull();
    expect(merged.problems.a.revisedAt).toBeNull();
  });

  it("fills in a side that has no entry for an id at all", () => {
    const merged = mergeStores(
      { version: 1, problems: {} },
      { version: 1, problems: { b: state({ done: true, revise: true, completedAt: "2026-02-02", revisedAt: "2026-02-03" }) } }
    );
    expect(merged.problems.b).toEqual(state({ done: true, revise: true, completedAt: "2026-02-02", revisedAt: "2026-02-03" }));
  });
});

describe("mergeStoresV2 tie-breaks", () => {
  const prog = (patch: Partial<QuestionProgressV2> = {}): QuestionProgressV2 => ({
    completed: false, starred: false, starredAt: null, firstCompletedAt: null, lastCompletedAt: null,
    completionGateVersion: null, approach: "", pseudocode: "", code: "",
    notes: { legacy: "", approach: "", keyInsight: "", commonMistake: "", complexity: "", edgeCases: "", reminder: "" },
    mistakes: [], revisionStats: { count: 0, lastRevisedAt: null, lastScore: null, lastConfidence: null },
    ...patch,
  });
  const rev = (patch: Partial<TopicRevision> = {}): TopicRevision => ({
    topicId: "arrays", cycle: 0, nextDueAt: null, lastPassedAt: null, lastFailedAt: null,
    activeSessionId: null, history: [], weakConcepts: {}, ...patch,
  });
  const store = (patch: Partial<AppStoreV2>): AppStoreV2 => ({ ...emptyAppStoreV2(), ...patch });

  it("on equal cycles, the later due date wins", () => {
    const a = store({ revision: { arrays: rev({ cycle: 1, nextDueAt: "2026-01-01" }) } });
    const b = store({ revision: { arrays: rev({ cycle: 1, nextDueAt: "2026-09-09" }) } });
    expect(mergeStoresV2(a, b).revision.arrays.nextDueAt).toBe("2026-09-09");
    // and symmetrically, whichever side holds it
    expect(mergeStoresV2(b, a).revision.arrays.nextDueAt).toBe("2026-09-09");
  });

  it("keeps the local starred date when only one side has starred it", () => {
    const a = store({ progress: { q: prog({ starred: true, starredAt: "2026-05-05" }) } });
    const b = store({ progress: { q: prog({ starred: false }) } });
    expect(mergeStoresV2(a, b).progress.q.starredAt).toBe("2026-05-05");
  });

  it("clears dates for a question neither side completed or starred", () => {
    const a = store({ progress: { q: prog({ firstCompletedAt: "2026-01-01", starredAt: "2026-01-01" }) } });
    const b = store({ progress: { q: prog() } });
    const merged = mergeStoresV2(a, b).progress.q;
    expect(merged.firstCompletedAt).toBeNull();
    expect(merged.lastCompletedAt).toBeNull();
    expect(merged.starredAt).toBeNull();
  });

  it("merges an orphaned entry that exists on both sides rather than overwriting", () => {
    const a = store({ orphanedProgress: { ghost: prog({ completed: true }) } });
    const b = store({ orphanedProgress: { ghost: prog({ starred: true }) } });
    const merged = mergeStoresV2(a, b).orphanedProgress.ghost;
    expect(merged.completed).toBe(true);
    expect(merged.starred).toBe(true);
  });

  it("falls back to the incoming topicId when the local record has none", () => {
    const a = store({ revision: { arrays: rev({ topicId: "" }) } });
    const b = store({ revision: { arrays: rev({ topicId: "arrays" }) } });
    expect(mergeStoresV2(a, b).revision.arrays.topicId).toBe("arrays");
  });
});
