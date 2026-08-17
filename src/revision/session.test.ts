import { describe, expect, it } from "vitest";
import questionsData from "../../data/questions.json";
import { scoreAttempt } from "./scoring";
import type { FundamentalScore } from "./scoring";
import { getFundamentalsForPattern, getPatternIdsForTopic, selectFundamentalsForTopic } from "./session";
import type { QuestionData } from "../types";

const QUESTIONS = questionsData as QuestionData;
const ALL_PATTERN_IDS = QUESTIONS.topics.flatMap((t) => t.patterns.map((p) => p.id));

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
