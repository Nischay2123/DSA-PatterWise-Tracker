import { REVISION_CONFIG } from "../config";
import type { AppSettings } from "../types";
import { evaluate, type LlmErrorCode } from "./client";
import { buildEvaluationPrompt } from "./prompt";

// The completion gate's grader. The gate itself (hasCompletionEvidence in
// store.ts) only ever checked that the pseudocode/code box was non-empty,
// which "abc" satisfies. This asks the model whether what you wrote is
// actually a solution to that specific problem.
//
// Deliberately the same prompt, client and validator the revision flow uses.
// A second grading prompt would be a second thing to keep honest, and the
// existing one already refuses to grade on style or on similarity to a
// stored solution -- both of which matter more here, where the thing being
// graded is code rather than recall.

export interface SolutionAttempt {
  questionId: string;
  title: string;
  patternName: string;
  difficulty: string;
  topicName: string;
  approach: string;
  pseudocode: string;
  code: string;
}

export type SolutionVerdict =
  // `note` is the model's own words, shown verbatim so a fail is arguable
  // rather than an oracle. Never a reason to lose work -- see CompletionPanel.
  | { kind: "pass"; score: number; note: string }
  | { kind: "fail"; score: number; mistakes: string[]; note: string }
  // The model couldn't be reached or couldn't be trusted. NOT a fail: the
  // plan is absolute that nothing is auto-failed, and a flaky network is not
  // evidence about your solution.
  | { kind: "ungraded"; error: LlmErrorCode };

// No key means no grading, and that must degrade to the old presence check
// rather than to a locked checkbox -- same reasoning as isGatingActive in
// store.ts: a personal tracker can't hold your own progress hostage to a
// third-party credential.
export function canGradeSolutions(settings: AppSettings): boolean {
  return !!settings.apiKey.trim();
}

// The gate's own score, not computeOverallScore's. It averages only the
// sub-scores for work the panel actually asked for, then scales to 0-100 on
// the same threshold revisions use.
//
// `pseudocode` counts only when pseudocode was submitted. The gate accepts
// pseudocode OR code, so counting an unwritten pseudocode sub-score marks
// you down for taking the option you were offered: a flawless code-only
// answer scored (5 + 5 + 0) / 3 * 20 = 67 and was rejected. Complexity and
// edge cases are never collected here, so they are never sent and never
// counted.
export function gateScore(
  q: { correctness: number; approach: number; pseudocode: number },
  submitted: { pseudocode: boolean }
): number {
  const parts = [q.correctness, q.approach, ...(submitted.pseudocode ? [q.pseudocode] : [])];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 20);
}

export async function gradeSolution(settings: AppSettings, attempt: SolutionAttempt): Promise<SolutionVerdict> {
  // Sent only when written. An empty block is an unanswered question to the
  // grader; an absent one is a question that was never asked.
  const pseudocode = attempt.pseudocode.trim() ? attempt.pseudocode : undefined;
  const code = attempt.code.trim() ? attempt.code : undefined;

  const prompt = buildEvaluationPrompt({
    topicName: attempt.topicName,
    fundamentals: [],
    questions: [
      {
        questionId: attempt.questionId,
        title: attempt.title,
        patternName: attempt.patternName,
        difficulty: attempt.difficulty,
        approach: attempt.approach,
        pseudocode,
        code,
        // Not collected at completion time, so not sent at all.
      },
    ],
  });

  const result = await evaluate({
    apiKey: settings.apiKey,
    provider: settings.provider,
    model: settings.model,
    prompt,
  });
  if (!result.ok) return { kind: "ungraded", error: result.error };

  // A response that graded some other id is a response about some other
  // question. Ungraded, never a fail.
  const graded = result.data.perQuestion.find((q) => q.questionId === attempt.questionId);
  if (!graded) return { kind: "ungraded", error: "INVALID_RESPONSE" };

  const score = gateScore(graded, { pseudocode: pseudocode !== undefined });
  const note = graded.note || result.data.feedback;
  if (score >= REVISION_CONFIG.passScore) return { kind: "pass", score, note };
  return { kind: "fail", score, mistakes: graded.mistakes, note };
}
