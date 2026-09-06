import { describe, expect, it } from "vitest";
import { computeOverallScore, scoreAttempt } from "./scoring";
import type { FundamentalScore, QuestionScore } from "./scoring";

function fundamental(patch: Partial<FundamentalScore> = {}): FundamentalScore {
  return { conceptId: "c1", criticality: "supporting", score: 5, ...patch };
}

function question(patch: Partial<QuestionScore> = {}): QuestionScore {
  return { questionId: "q1", correctness: 5, approach: 5, pseudocode: 5, complexity: 5, ...patch };
}

describe("computeOverallScore", () => {
  it("scales a perfect score to 100", () => {
    expect(computeOverallScore([fundamental({ score: 5 })], [])).toBe(100);
  });

  it("scales a zero score to 0", () => {
    expect(computeOverallScore([fundamental({ score: 0 })], [])).toBe(0);
  });

  it("weighs fundamentals and question sub-scores equally in one average", () => {
    // one fundamental at 5, one question with all four sub-scores at 1 -> avg = (5+1+1+1+1)/5 = 1.8 -> 36
    expect(computeOverallScore([fundamental({ score: 5 })], [question({ correctness: 1, approach: 1, pseudocode: 1, complexity: 1 })])).toBe(36);
  });

  it("returns 0 with no scores at all", () => {
    expect(computeOverallScore([], [])).toBe(0);
  });
});

describe("scoreAttempt -- pass/fail threshold", () => {
  it("passes at exactly 70", () => {
    const result = scoreAttempt([fundamental({ score: 3.5 })], []);
    expect(result.overallScore).toBe(70);
    expect(result.passed).toBe(true);
  });

  it("fails at 69", () => {
    const result = scoreAttempt([fundamental({ score: 3.45 })], []);
    expect(result.overallScore).toBe(69);
    expect(result.passed).toBe(false);
  });
});

describe("scoreAttempt -- the critical-concept floor", () => {
  it("passing by total is still failed by a core concept below the floor", () => {
    const result = scoreAttempt(
      [fundamental({ conceptId: "core1", criticality: "core", score: 1 }), fundamental({ score: 5 }), fundamental({ score: 5 })],
      []
    );
    expect(result.overallScore).toBeGreaterThanOrEqual(70); // passes by total
    expect(result.passed).toBe(false); // but blocked by the floor
    expect(result.criticalFloorFailed).toBe(true);
  });

  it("a pattern with zero core concepts passes the floor rule vacuously (no NaN, no silent failure)", () => {
    const result = scoreAttempt([fundamental({ criticality: "supporting", score: 5 })], []);
    expect(Number.isNaN(result.overallScore)).toBe(false);
    expect(result.criticalFloorFailed).toBe(false);
    expect(result.passed).toBe(true); // nothing spuriously blocks it
  });

  it("a core concept at exactly the floor value passes it", () => {
    const result = scoreAttempt([fundamental({ criticality: "core", score: 2 })], []);
    expect(result.criticalFloorFailed).toBe(false);
  });

  it("does not report criticalFloorFailed when the total independently fails too", () => {
    // Below the floor AND below the total -- the floor isn't "what" blocked it, so this stays false
    // per the documented semantics: criticalFloorFailed only fires for an otherwise-passing total.
    const result = scoreAttempt([fundamental({ criticality: "core", score: 1 })], []);
    expect(result.overallScore).toBeLessThan(70);
    expect(result.passed).toBe(false);
    expect(result.criticalFloorFailed).toBe(false);
  });
});

describe("scoreAttempt -- weak concepts", () => {
  it("collects concepts scoring below the floor, core or supporting", () => {
    const result = scoreAttempt(
      [
        fundamental({ conceptId: "weak-core", criticality: "core", score: 1 }),
        fundamental({ conceptId: "weak-supporting", criticality: "supporting", score: 0 }),
        fundamental({ conceptId: "strong", criticality: "supporting", score: 5 }),
      ],
      []
    );
    expect(result.weakConceptIds.sort()).toEqual(["weak-core", "weak-supporting"]);
  });

  it("is empty when nothing is weak", () => {
    const result = scoreAttempt([fundamental({ score: 5 })], []);
    expect(result.weakConceptIds).toEqual([]);
  });
});
