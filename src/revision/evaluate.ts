import { REVISION_CONFIG } from "../config";
import type { EvaluationResult, RevisionAttempt, Topic } from "../types";
import type { PromptInput } from "../llm/prompt";
import { scoreAttempt } from "./scoring";
import type { FundamentalScore, QuestionScore, ScoringResult } from "./scoring";
import { getConceptById } from "./session";

// Assembles what the evaluator needs to see. The stored solution is
// deliberately NOT sent: the plan's grading rule is "semantic correctness,
// not similarity to the stored solution", and the surest way to honour that
// is to never put the reference answer in front of the model at all. The
// problem's title/pattern/difficulty is enough to identify it.
export function buildPromptInput(attempt: RevisionAttempt, topic: Topic): PromptInput {
  const byId = new Map(
    topic.patterns.flatMap((p) => p.problems.map((q) => [q.id, { problem: q, patternName: p.name }]))
  );

  return {
    topicName: topic.name,
    fundamentals: attempt.fundamentals.map((f) => {
      const concept = getConceptById(f.conceptId);
      return {
        conceptId: f.conceptId,
        prompt: concept?.prompt ?? f.conceptId,
        expectedConcepts: concept?.expectedConcepts ?? [],
        answer: f.answer,
      };
    }),
    questions: attempt.questions.map((q) => {
      const entry = byId.get(q.questionId);
      return {
        questionId: q.questionId,
        title: entry?.problem.question ?? q.questionId,
        patternName: entry?.patternName ?? "",
        difficulty: entry?.problem.difficulty ?? "",
        approach: q.approach,
        pseudocode: q.pseudocode,
        complexity: q.complexity,
        edgeCases: q.edgeCases,
      };
    }),
  };
}

export interface ScoredEvaluation {
  scoring: ScoringResult;
  // questionId -> 0-100, for revisionStats.lastScore. Same x20 scaling
  // computeOverallScore uses, so the two are on one comparable scale (which
  // is what selection.ts's `lastRevisionScore < passScore` check assumes).
  questionScores: Record<string, number>;
  // Questions that didn't clear passScore. TopicRevision.weakConcepts is
  // keyed by "conceptId | questionId" (plan §6), and selection.ts reads
  // weakConcepts[problem.id] for its weakBoostFactor -- so without these
  // ids the boost could never fire for a question, only for a concept.
  weakQuestionIds: string[];
}

// Turns a validated model response into the real, client-side grade.
//
// Returns null when the model didn't score everything it was asked to. That
// is treated as an invalid response rather than scoring the gaps as zero,
// because a zero here is indistinguishable from "the user got it wrong" and
// the plan is absolute that nothing is ever auto-failed. Hallucinated ids
// that match nothing in the attempt are simply ignored.
export function scoreEvaluation(attempt: RevisionAttempt, evaluation: EvaluationResult): ScoredEvaluation | null {
  const fundamentalById = new Map(evaluation.perFundamental.map((f) => [f.conceptId, f]));
  const questionById = new Map(evaluation.perQuestion.map((q) => [q.questionId, q]));

  const fundamentalScores: FundamentalScore[] = [];
  for (const f of attempt.fundamentals) {
    const graded = fundamentalById.get(f.conceptId);
    if (!graded) return null;
    fundamentalScores.push({
      conceptId: f.conceptId,
      // An unknown concept can't be allowed to trip the critical-concept
      // floor, so it degrades to `supporting` rather than `core`.
      criticality: getConceptById(f.conceptId)?.criticality ?? "supporting",
      score: graded.score,
    });
  }

  const questionScores: QuestionScore[] = [];
  const perQuestion100: Record<string, number> = {};
  const weakQuestionIds: string[] = [];
  for (const q of attempt.questions) {
    const graded = questionById.get(q.questionId);
    if (!graded) return null;
    questionScores.push({
      questionId: q.questionId,
      correctness: graded.correctness,
      approach: graded.approach,
      pseudocode: graded.pseudocode,
      complexity: graded.complexity,
    });
    const avg = (graded.correctness + graded.approach + graded.pseudocode + graded.complexity) / 4;
    const score100 = Math.round(avg * 20);
    perQuestion100[q.questionId] = score100;
    // Same bar the whole system uses for "good enough", rather than a second
    // threshold that could disagree with passScore.
    if (score100 < REVISION_CONFIG.passScore) weakQuestionIds.push(q.questionId);
  }

  // scoreAttempt is Phase 4's, untouched: it owns passScore and the
  // critical-concept floor. The model's own `passed`/`score` are never
  // consulted here -- they are display data only (plan §9).
  return { scoring: scoreAttempt(fundamentalScores, questionScores), questionScores: perQuestion100, weakQuestionIds };
}
