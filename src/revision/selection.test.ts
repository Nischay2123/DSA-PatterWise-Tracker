import { describe, expect, it } from "vitest";
import { REVISION_CONFIG } from "../config";
import { computeQuestionWeight, selectQuestionsForSession } from "./selection";
import type { SelectionCandidate } from "./selection";

function candidate(patch: Partial<SelectionCandidate> = {}): SelectionCandidate {
  return {
    id: "q1",
    patternId: "p1",
    difficulty: "Easy",
    isWeak: false,
    lastConfidence: "strong",
    lastRevisionScore: 90,
    mistakesCount: 0,
    daysSinceLastRevised: 0,
    ...patch,
  };
}

describe("computeQuestionWeight", () => {
  it("is 1 for a fully neutral, already-revised candidate", () => {
    expect(computeQuestionWeight(candidate())).toBe(1);
  });

  it("weak concepts get weakBoostFactor (3x)", () => {
    expect(computeQuestionWeight(candidate({ isWeak: true }))).toBe(3);
  });

  it("forgot confidence multiplies by 3, partial by 1.75", () => {
    expect(computeQuestionWeight(candidate({ lastConfidence: "forgot" }))).toBe(3);
    expect(computeQuestionWeight(candidate({ lastConfidence: "partial" }))).toBe(1.75);
  });

  it("a below-pass-score last revision doubles the weight", () => {
    expect(computeQuestionWeight(candidate({ lastRevisionScore: 50 }))).toBe(2);
  });

  it("having any mistakes multiplies by 1.5", () => {
    expect(computeQuestionWeight(candidate({ mistakesCount: 2 }))).toBe(1.5);
  });

  it("difficulty scales Hard 1.4x and Medium 1.15x", () => {
    expect(computeQuestionWeight(candidate({ difficulty: "Hard" }))).toBe(1.4);
    expect(computeQuestionWeight(candidate({ difficulty: "Medium" }))).toBeCloseTo(1.15);
  });

  it("staleness adds 1/30th per day since last revised", () => {
    expect(computeQuestionWeight(candidate({ daysSinceLastRevised: 30 }))).toBe(2);
    expect(computeQuestionWeight(candidate({ daysSinceLastRevised: 60 }))).toBe(3);
  });

  it("never revised (null) gets a flat 1.5x, not conflated with staleness", () => {
    expect(computeQuestionWeight(candidate({ daysSinceLastRevised: null }))).toBe(1.5);
  });

  it("factors compose multiplicatively", () => {
    const w = computeQuestionWeight(
      candidate({ isWeak: true, lastConfidence: "forgot", lastRevisionScore: 50, mistakesCount: 1, difficulty: "Hard", daysSinceLastRevised: 30 })
    );
    // 3 (weak) * 3 (forgot) * 2 (low score) * 1.5 (mistakes) * 1.4 (hard) * 2 (30 days stale)
    expect(w).toBeCloseTo(3 * 3 * 2 * 1.5 * 1.4 * 2);
  });
});

describe("selectQuestionsForSession", () => {
  const pool = Array.from({ length: 10 }, (_, i) => candidate({ id: `q${i}`, patternId: `p${i}` }));

  it("never returns duplicates", () => {
    const picked = selectQuestionsForSession(pool, 5, 42);
    const ids = picked.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns all candidates, no crash or padding, when fewer are available than requested", () => {
    const small = pool.slice(0, 2);
    const picked = selectQuestionsForSession(small, 5, 1);
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((c) => c.id))).toEqual(new Set(["q0", "q1"]));
  });

  it("returns exactly `count` items when enough are available", () => {
    expect(selectQuestionsForSession(pool, 3, 7)).toHaveLength(3);
  });

  it("a weak-tagged question is meaningfully over-represented across 1000 seeded runs", () => {
    const withOneWeak = pool.map((c, i) => (i === 0 ? { ...c, isWeak: true } : c));
    let weakPickedCount = 0;
    const runs = 1000;
    for (let seed = 0; seed < runs; seed++) {
      const picked = selectQuestionsForSession(withOneWeak, 3, seed);
      if (picked.some((c) => c.id === "q0")) weakPickedCount++;
    }
    const rate = weakPickedCount / runs;
    // Naive uniform selection of 3-of-10 would include any given item ~30%
    // of the time. weakBoostFactor triples its weight relative to the other
    // 9 -- the observed rate must be clearly, not marginally, above baseline.
    expect(rate).toBeGreaterThan(0.45);
  });

  it("spreads across distinct patterns when enough are available (no pattern repeats before all are used)", () => {
    const picked = selectQuestionsForSession(pool, 5, 3);
    const patternIds = picked.map((c) => c.patternId);
    expect(new Set(patternIds).size).toBe(patternIds.length); // 5 picks, 10 distinct patterns available -- never forced to repeat
  });
});

// Added after mutation testing: the original fixture gave every candidate its
// own patternId, so "no duplicates" and "spreads across patterns" were
// indistinguishable -- each guarantee was silently upheld by the OTHER
// mechanism. Stryker proved it by deleting `usedPatterns.add(...)` and
// `pool.splice(...)` in turn and having every test still pass. A realistic
// fixture (several questions per pattern) separates them.
describe("selection guarantees, with several questions sharing a pattern", () => {
  const shared = [
    ...["a1", "a2", "a3"].map((id) => candidate({ id, patternId: "arrays__hashing" })),
    ...["b1", "b2", "b3"].map((id) => candidate({ id, patternId: "arrays__two-pointers" })),
    ...["c1", "c2", "c3"].map((id) => candidate({ id, patternId: "arrays__sliding-window" })),
  ];

  it("never returns the same question twice", () => {
    for (let seed = 0; seed < 50; seed++) {
      const ids = selectQuestionsForSession(shared, 3, seed).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("takes one question from each pattern before repeating a pattern", () => {
    for (let seed = 0; seed < 50; seed++) {
      const patterns = selectQuestionsForSession(shared, 3, seed).map((c) => c.patternId);
      expect(new Set(patterns).size).toBe(3);
    }
  });

  it("falls back to the full pool once every pattern has contributed", () => {
    // 5 picks from 3 patterns: the first 3 must be distinct patterns, then it
    // has no choice but to reuse one -- without duplicating a question.
    for (let seed = 0; seed < 25; seed++) {
      const picked = selectQuestionsForSession(shared, 5, seed);
      expect(picked).toHaveLength(5);
      expect(new Set(picked.map((c) => c.id)).size).toBe(5);
      expect(new Set(picked.slice(0, 3).map((c) => c.patternId)).size).toBe(3);
    }
  });
});

describe("weighting boundaries", () => {
  it("a score exactly at passScore is not treated as a failure", () => {
    const atPass = computeQuestionWeight(candidate({ lastRevisionScore: REVISION_CONFIG.passScore }));
    const justUnder = computeQuestionWeight(candidate({ lastRevisionScore: REVISION_CONFIG.passScore - 1 }));
    expect(atPass).toBe(computeQuestionWeight(candidate({ lastRevisionScore: 100 })));
    expect(justUnder).toBe(atPass * 2);
  });

  it("a zero score still only doubles, never more", () => {
    expect(computeQuestionWeight(candidate({ lastRevisionScore: 0 }))).toBe(
      computeQuestionWeight(candidate({ lastRevisionScore: 100 })) * 2
    );
  });
});
