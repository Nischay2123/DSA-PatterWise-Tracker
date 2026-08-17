import { REVISION_CONFIG } from "../config";

export interface FundamentalScore {
  conceptId: string;
  criticality: "core" | "supporting";
  score: number; // 0-5
}

export interface QuestionScore {
  questionId: string;
  correctness: number; // 0-5
  approach: number;
  pseudocode: number;
  complexity: number;
}

export interface ScoringResult {
  overallScore: number; // 0-100
  passed: boolean;
  criticalFloorFailed: boolean; // true only when the floor is what blocked an otherwise-passing total
  weakConceptIds: string[]; // fed into TopicRevision.weakConcepts regardless of pass/fail
}

// The critical-concept floor (plan §8): every(), never an average. Averaging
// core scores divides by zero on a pattern with no core concepts --
// verified against the real data, fundamentals__logical-thinking is exactly
// that case -- yielding NaN, and `NaN >= floor` is false, which would
// silently fail every revision touching it. every() on an empty array is
// vacuously true, which is the correct behavior: the floor rule simply
// doesn't apply where there's nothing to floor.
function passesCriticalFloor(fundamentals: FundamentalScore[]): boolean {
  const core = fundamentals.filter((f) => f.criticality === "core");
  return core.every((f) => f.score >= REVISION_CONFIG.criticalConceptFloor);
}

// Aggregation formula: the plan specifies the LLM's per-fundamental/
// per-question response shape (§9&10) and passScore (§5), but not the exact
// formula for combining many 0-5 sub-scores into one 0-100 total. This
// implementation weighs every individual sub-score equally -- each
// fundamental's score, and each question's correctness/approach/
// pseudocode/complexity -- and scales the average by 20. Documented as an
// assumption in the Phase 4 report; Phase 7 (once a real LLM response
// exists) can revisit the weighting if a different one is intended.
export function computeOverallScore(fundamentals: FundamentalScore[], questions: QuestionScore[]): number {
  const subScores: number[] = [
    ...fundamentals.map((f) => f.score),
    ...questions.flatMap((q) => [q.correctness, q.approach, q.pseudocode, q.complexity]),
  ];
  if (!subScores.length) return 0;
  const average = subScores.reduce((a, b) => a + b, 0) / subScores.length;
  return Math.round(average * 20);
}

export function scoreAttempt(fundamentals: FundamentalScore[], questions: QuestionScore[]): ScoringResult {
  const overallScore = computeOverallScore(fundamentals, questions);
  const floorOk = passesCriticalFloor(fundamentals);
  const passed = overallScore >= REVISION_CONFIG.passScore && floorOk;
  // Same floor value doubles as the "weak concept" threshold -- the plan
  // doesn't specify a separate one, and reusing it keeps the two ideas
  // (blocks a pass / gets weighted up next time) consistent by construction.
  const weakConceptIds = fundamentals
    .filter((f) => f.score < REVISION_CONFIG.criticalConceptFloor)
    .map((f) => f.conceptId);
  return { overallScore, passed, criticalFloorFailed: !floorOk && overallScore >= REVISION_CONFIG.passScore, weakConceptIds };
}
