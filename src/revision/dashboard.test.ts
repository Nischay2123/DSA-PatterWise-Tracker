import { describe, expect, it } from "vitest";
import { emptyAppStoreV2 } from "../persistence/migrate";
import { buildTopicRows, countDashboard, statusDot, statusLabel } from "./dashboard";
import { computeQuestionWeight } from "./selection";
import type { SelectionCandidate } from "./selection";
import type { AppStoreV2, ProgressStore, Topic, TopicRevision } from "../types";

function topic(id: string, problemIds: string[]): Topic {
  return {
    id,
    name: id,
    patterns: [
      {
        id: `${id}__p1`,
        name: "P1",
        problems: problemIds.map((pid) => ({
          id: pid,
          subpattern: "",
          question: pid,
          platform: "",
          link: null,
          difficulty: "Easy" as const,
          originalStep: "",
          estMinutes: "",
          importance: "High",
          interviewFreq: "High",
        })),
      },
    ],
  };
}

function storeWithDone(ids: string[]): ProgressStore {
  const problems: ProgressStore["problems"] = {};
  for (const id of ids) problems[id] = { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null };
  return { version: 1, problems, idsMigrated: true };
}

function revision(patch: Partial<TopicRevision> = {}): TopicRevision {
  return {
    topicId: "arrays",
    cycle: 0,
    nextDueAt: null,
    lastPassedAt: null,
    lastFailedAt: null,
    activeSessionId: null,
    history: [],
    weakConcepts: {},
    ...patch,
  };
}

function v2With(revisionMap: Record<string, TopicRevision>): AppStoreV2 {
  return { ...emptyAppStoreV2(), revision: revisionMap };
}

const NOW = new Date("2026-06-15T12:00:00.000Z");
const TOPICS = [topic("arrays", ["a1", "a2", "a3", "a4"])];
const ALL_DONE = storeWithDone(["a1", "a2", "a3", "a4"]);

describe("buildTopicRows", () => {
  it("omits exempt topics entirely (plan §5)", () => {
    const rows = buildTopicRows([topic("fundamentals", ["f1"]), ...TOPICS], ALL_DONE, emptyAppStoreV2(), NOW);
    expect(rows.map((r) => r.topicId)).toEqual(["arrays"]);
  });

  it("derives completion, cycle and due distance", () => {
    const v2 = v2With({ arrays: revision({ cycle: 2, nextDueAt: "2026-06-25" }) });
    const [row] = buildTopicRows(TOPICS, ALL_DONE, v2, NOW);
    expect(row.completionPct).toBe(1);
    expect(row.cycle).toBe(2);
    expect(row.daysUntilDue).toBe(10);
  });

  it("reports a negative daysUntilDue for an overdue topic", () => {
    const v2 = v2With({ arrays: revision({ nextDueAt: "2026-06-05" }) });
    const [row] = buildTopicRows(TOPICS, ALL_DONE, v2, NOW);
    expect(row.daysUntilDue).toBe(-10);
  });

  it("surfaces the last score and orders weak concepts heaviest first", () => {
    const v2 = v2With({
      arrays: revision({
        history: [{ at: "2026-06-01", score: 55, passed: false, attemptId: "x" }],
        weakConcepts: { light: 1, heavy: 9, mid: 4 },
      }),
    });
    const [row] = buildTopicRows(TOPICS, ALL_DONE, v2, NOW);
    expect(row.lastScore).toBe(55);
    expect(row.weakConcepts.map((w) => w.id)).toEqual(["heavy", "mid", "light"]);
  });

  it("handles a topic with no revision record at all", () => {
    const [row] = buildTopicRows(TOPICS, storeWithDone([]), emptyAppStoreV2(), NOW);
    expect(row.state).toBe("NOT_STARTED");
    expect(row.daysUntilDue).toBeNull();
    expect(row.lastScore).toBeNull();
  });
});

describe("countDashboard", () => {
  it("separates due-today from overdue", () => {
    const rows = [
      ...buildTopicRows([topic("arrays", ["a1"])], storeWithDone(["a1"]), v2With({ arrays: revision({ nextDueAt: "2026-06-15" }) }), NOW),
      ...buildTopicRows([topic("graphs", ["g1"])], storeWithDone(["g1"]), v2With({ graphs: revision({ topicId: "graphs", nextDueAt: "2026-05-01" }) }), NOW),
    ];
    const counts = countDashboard(rows);
    expect(counts.dueToday).toBe(1);
    expect(counts.overdue).toBe(1);
  });

  it("counts a scheduled topic as upcoming", () => {
    const rows = buildTopicRows(TOPICS, ALL_DONE, v2With({ arrays: revision({ nextDueAt: "2026-07-01" }) }), NOW);
    expect(countDashboard(rows).upcoming).toBe(1);
  });

  it("counts mastered topics", () => {
    const v2 = v2With({ arrays: revision({ cycle: 3, nextDueAt: "2026-07-01" }) });
    const rows = buildTopicRows(TOPICS, ALL_DONE, v2, NOW);
    expect(countDashboard(rows).mastered).toBe(1);
  });

  it("calls a topic strong or weak by its most recent graded attempt", () => {
    const strong = buildTopicRows(TOPICS, ALL_DONE, v2With({
      arrays: revision({ nextDueAt: "2026-07-01", history: [
        { at: "2026-01-01", score: 40, passed: false, attemptId: "old" },
        { at: "2026-06-01", score: 95, passed: true, attemptId: "new" },
      ] }),
    }), NOW);
    expect(countDashboard(strong).strong).toBe(1);
    expect(countDashboard(strong).weak).toBe(0);

    const weak = buildTopicRows(TOPICS, ALL_DONE, v2With({
      arrays: revision({ nextDueAt: "2026-07-01", history: [{ at: "2026-06-01", score: 40, passed: false, attemptId: "n" }] }),
    }), NOW);
    expect(countDashboard(weak).weak).toBe(1);
  });

  it("counts an ungraded topic as neither strong nor weak", () => {
    const rows = buildTopicRows(TOPICS, ALL_DONE, emptyAppStoreV2(), NOW);
    const counts = countDashboard(rows);
    expect(counts.strong).toBe(0);
    expect(counts.weak).toBe(0);
  });
});

describe("statusDot / statusLabel", () => {
  function rowFor(patch: Partial<TopicRevision>, store = ALL_DONE) {
    return buildTopicRows(TOPICS, store, v2With({ arrays: revision(patch) }), NOW)[0];
  }

  it("flags a due topic red", () => {
    const row = rowFor({ nextDueAt: "2026-06-01" });
    expect(statusDot(row)).toBe("🔴");
    expect(statusLabel(row)).toBe("Overdue by 14 days");
  });

  it("flags an imminent topic amber and a distant one green", () => {
    expect(statusDot(rowFor({ nextDueAt: "2026-06-16" }))).toBe("🟡");
    expect(statusDot(rowFor({ nextDueAt: "2026-07-30" }))).toBe("🟢");
  });

  it("says due tomorrow, and next in N days", () => {
    expect(statusLabel(rowFor({ nextDueAt: "2026-06-16" }))).toBe("Due tomorrow");
    expect(statusLabel(rowFor({ nextDueAt: "2026-06-24" }))).toBe("Next in 9 days");
  });

  it("describes an untouched topic plainly", () => {
    const row = buildTopicRows(TOPICS, storeWithDone([]), emptyAppStoreV2(), NOW)[0];
    expect(statusDot(row)).toBe("⚪");
    expect(statusLabel(row)).toBe("Not started");
  });
});

// The plan's Phase 8 acceptance test, stated in its own words:
// "failed revision demonstrably over-weights its weak concepts next session".
// Phases 4-7 built every half of this; the link only closed once evaluations
// started writing weak QUESTION ids into weakConcepts, which selection.ts
// reads by question id.
describe("a failed revision demonstrably over-weights its weak questions next session", () => {
  function candidate(patch: Partial<SelectionCandidate> = {}): SelectionCandidate {
    return {
      id: "q1",
      patternId: "arrays__p1",
      difficulty: "Easy",
      isWeak: false,
      lastConfidence: null,
      lastRevisionScore: null,
      mistakesCount: 0,
      daysSinceLastRevised: 10,
      ...patch,
    };
  }

  it("weights a flagged-weak question far above an identical unflagged one", () => {
    const plain = computeQuestionWeight(candidate());
    const weak = computeQuestionWeight(candidate({ isWeak: true }));
    expect(weak / plain).toBe(3); // REVISION_CONFIG.weakBoostFactor
  });

  it("compounds with the low-score signal the same failure also records", () => {
    const plain = computeQuestionWeight(candidate());
    const failed = computeQuestionWeight(candidate({ isWeak: true, lastRevisionScore: 40 }));
    expect(failed).toBeGreaterThan(plain * 5);
  });
});
