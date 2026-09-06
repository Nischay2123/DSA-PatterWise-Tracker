import { describe, expect, it } from "vitest";
import questionsData from "../../data/questions.json";
import { emptyAppStoreV2 } from "../persistence/migrate";
import { patchV2FromV1 } from "../store";
import { scoreAttempt } from "./scoring";
import type { FundamentalScore } from "./scoring";
import {
  buildSelectionCandidates,
  createRevisionAttempt,
  getConceptById,
  getFundamentalsForPattern,
  getPatternIdsForTopic,
  mostRecentAttemptForTopic,
  selectFundamentalsForTopic,
} from "./session";
import type { AppStoreV2, ProgressStore, QuestionData, RevisionAttempt } from "../types";

const QUESTIONS = questionsData as QuestionData;
const ALL_PATTERN_IDS = QUESTIONS.topics.flatMap((t) => t.patterns.map((p) => p.id));
const ARRAYS_PROBLEM_IDS = QUESTIONS.topics.find((t) => t.id === "arrays")!.patterns.flatMap((p) => p.problems.map((q) => q.id));

function v1StoreOf(id: string, done: boolean): ProgressStore {
  return { version: 1, idsMigrated: true, problems: { [id]: { done, revise: false, notes: "", completedAt: done ? "2026-01-01" : null, revisedAt: null } } };
}

function completeReal(v2: AppStoreV2, ids: string[]): AppStoreV2 {
  let next = v2;
  for (const id of ids) next = patchV2FromV1(next, v1StoreOf(id, true));
  return next;
}

describe("fundamentals coverage (real data)", () => {
  it("every pattern id in questions.json has a non-empty fundamentals entry", () => {
    for (const id of ALL_PATTERN_IDS) {
      expect(getFundamentalsForPattern(id).length).toBeGreaterThan(0);
    }
  });

  it("no concept id is duplicated across the whole dataset", () => {
    const seen = new Set<string>();
    for (const id of ALL_PATTERN_IDS) {
      for (const concept of getFundamentalsForPattern(id)) {
        expect(seen.has(concept.id)).toBe(false);
        seen.add(concept.id);
      }
    }
  });
});

describe("selectFundamentalsForTopic", () => {
  it("returns fundamentalsPerSession items spread across the topic's patterns", () => {
    const patternIds = getPatternIdsForTopic("graphs"); // 12 patterns, plenty to spread across
    const selected = selectFundamentalsForTopic("graphs", 42, 4);
    expect(selected).toHaveLength(4);
    const sourcePatterns = new Set(
      selected.map((c) => patternIds.find((pid) => getFundamentalsForPattern(pid).some((x) => x.id === c.id)))
    );
    expect(sourcePatterns.size).toBeGreaterThan(1); // not all four from the same pattern
  });

  it("is deterministic for a given seed", () => {
    const a = selectFundamentalsForTopic("dp", 7, 4);
    const b = selectFundamentalsForTopic("dp", 7, 4);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("does not crash and returns what's available on a topic with only one pattern", () => {
    const selected = selectFundamentalsForTopic("advanced-strings", 1, 4);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(4);
  });

  it("returns an empty array for an unknown topic instead of crashing", () => {
    expect(selectFundamentalsForTopic("does-not-exist", 1, 4)).toEqual([]);
  });
});

describe("fundamentals__logical-thinking (the one zero-core pattern) does not crash the loader or scoring.ts", () => {
  it("loads normally with only supporting concepts", () => {
    const concepts = getFundamentalsForPattern("fundamentals__logical-thinking");
    expect(concepts.length).toBeGreaterThan(0);
    expect(concepts.every((c) => c.criticality === "supporting")).toBe(true);
  });

  it("scores without NaN or a spurious floor failure", () => {
    const concepts = getFundamentalsForPattern("fundamentals__logical-thinking");
    const scores: FundamentalScore[] = concepts.map((c) => ({ conceptId: c.id, criticality: c.criticality, score: 5 }));
    const result = scoreAttempt(scores, []);
    expect(Number.isNaN(result.overallScore)).toBe(false);
    expect(result.criticalFloorFailed).toBe(false);
    expect(result.passed).toBe(true);
  });
});

describe("getConceptById", () => {
  it("finds a real concept by id", () => {
    const concepts = getFundamentalsForPattern("arrays__sliding-window");
    expect(getConceptById(concepts[0].id)).toEqual(concepts[0]);
  });

  it("returns null for an unknown id instead of crashing", () => {
    expect(getConceptById("does-not-exist")).toBeNull();
  });
});

describe("buildSelectionCandidates", () => {
  it("includes only completed questions from the topic", () => {
    const [a, b] = ARRAYS_PROBLEM_IDS;
    const v2 = completeReal(emptyAppStoreV2(), [a]);
    const candidates = buildSelectionCandidates("arrays", v2, QUESTIONS);
    expect(candidates.some((c) => c.id === a)).toBe(true);
    expect(candidates.some((c) => c.id === b)).toBe(false);
  });

  it("carries real revisionStats/mistakes/weakConcepts into the candidate fields", () => {
    const [a] = ARRAYS_PROBLEM_IDS;
    let v2 = completeReal(emptyAppStoreV2(), [a]);
    v2 = {
      ...v2,
      progress: { ...v2.progress, [a]: { ...v2.progress[a], mistakes: [{ at: "2026-01-01T00:00:00.000Z", what: "x", remember: "y" }], revisionStats: { count: 1, lastRevisedAt: "2026-01-01", lastScore: 50, lastConfidence: "forgot" } } },
      revision: { arrays: { topicId: "arrays", cycle: 0, nextDueAt: null, lastPassedAt: null, lastFailedAt: null, activeSessionId: null, history: [], weakConcepts: { [a]: 2 } } },
    };
    const candidate = buildSelectionCandidates("arrays", v2, QUESTIONS, new Date("2026-01-08")).find((c) => c.id === a)!;
    expect(candidate.isWeak).toBe(true);
    expect(candidate.lastConfidence).toBe("forgot");
    expect(candidate.mistakesCount).toBe(1);
    expect(candidate.daysSinceLastRevised).toBe(7);
  });

  it("returns an empty array for an unknown topic instead of crashing", () => {
    expect(buildSelectionCandidates("does-not-exist", emptyAppStoreV2(), QUESTIONS)).toEqual([]);
  });

  it("returns an empty array when nothing in the topic is completed yet", () => {
    expect(buildSelectionCandidates("arrays", emptyAppStoreV2(), QUESTIONS)).toEqual([]);
  });
});

describe("createRevisionAttempt", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("assembles a complete draft attempt with the requested shape", () => {
    const v2 = completeReal(emptyAppStoreV2(), ARRAYS_PROBLEM_IDS.slice(0, 5));
    const attempt = createRevisionAttempt("att1", "arrays", v2, QUESTIONS, now);

    expect(attempt.id).toBe("att1");
    expect(attempt.topicId).toBe("arrays");
    expect(attempt.submittedAt).toBeNull();
    expect(attempt.evaluationStatus).toBe("DRAFT");
    expect(attempt.fundamentals.length).toBeGreaterThan(0);
    expect(attempt.fundamentals.every((f) => f.answer === "")).toBe(true);
    expect(attempt.questions.length).toBeGreaterThan(0);
    expect(attempt.questions.every((q) => q.confidence === null && q.approach === "")).toBe(true);
  });

  it("never crashes on a topic with zero completed questions -- fundamentals still populate", () => {
    const attempt = createRevisionAttempt("att1", "arrays", emptyAppStoreV2(), QUESTIONS, now);
    expect(attempt.questions).toEqual([]);
    expect(attempt.fundamentals.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same `now`", () => {
    const v2 = completeReal(emptyAppStoreV2(), ARRAYS_PROBLEM_IDS.slice(0, 5));
    const a = createRevisionAttempt("att1", "arrays", v2, QUESTIONS, now);
    const b = createRevisionAttempt("att1", "arrays", v2, QUESTIONS, now);
    expect(a.fundamentals.map((f) => f.conceptId)).toEqual(b.fundamentals.map((f) => f.conceptId));
    expect(a.questions.map((q) => q.questionId)).toEqual(b.questions.map((q) => q.questionId));
  });
});

describe("mostRecentAttemptForTopic", () => {
  function attempt(patch: Partial<RevisionAttempt>): RevisionAttempt {
    return {
      id: "a", topicId: "arrays", startedAt: "2026-01-01T00:00:00.000Z", submittedAt: null,
      fundamentals: [], questions: [], evaluationStatus: "DRAFT", evaluation: null, error: null,
      ...patch,
    };
  }

  it("returns null when the topic has no attempts", () => {
    expect(mostRecentAttemptForTopic(emptyAppStoreV2(), "arrays")).toBeNull();
  });

  it("returns the only attempt for that topic, ignoring other topics", () => {
    const v2 = { ...emptyAppStoreV2(), attempts: { a: attempt({ id: "a" }), b: attempt({ id: "b", topicId: "graphs" }) } };
    expect(mostRecentAttemptForTopic(v2, "arrays")?.id).toBe("a");
  });

  it("picks the one with the latest startedAt, submitted or not -- this is what lets Results show right after submit", () => {
    const v2 = {
      ...emptyAppStoreV2(),
      attempts: {
        old: attempt({ id: "old", startedAt: "2026-01-01T00:00:00.000Z", submittedAt: "2026-01-01T00:05:00.000Z" }),
        justSubmitted: attempt({ id: "justSubmitted", startedAt: "2026-01-08T00:00:00.000Z", submittedAt: "2026-01-08T00:10:00.000Z" }),
      },
    };
    expect(mostRecentAttemptForTopic(v2, "arrays")?.id).toBe("justSubmitted");
  });

  it("on an exact startedAt tie (StrictMode double-dispatch), prefers the later-inserted one over the earlier orphan", () => {
    const tie = "2026-01-01T00:00:00.000Z";
    const v2 = {
      ...emptyAppStoreV2(),
      attempts: {
        orphan: attempt({ id: "orphan", startedAt: tie, submittedAt: null }),
        real: attempt({ id: "real", startedAt: tie, submittedAt: "2026-01-01T00:10:00.000Z" }),
      },
    };
    expect(mostRecentAttemptForTopic(v2, "arrays")?.id).toBe("real");
  });
});
