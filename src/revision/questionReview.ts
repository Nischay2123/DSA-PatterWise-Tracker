import { QUESTION_REVIEW_DAYS } from "../config";
import type { AppStoreV2, QuestionProgressV2, QuestionReview, ReviewOutcome } from "../types";

// Per-question spaced repetition, alongside (not instead of) the topic-level
// AI-graded sessions. After a solve the question comes back in 1 day, then
// 3, 7, 15, 30, 60. `step` indexes the interval currently being waited out;
// passing the last one cleanly is mastery.
//
//   clean    -> next step (past the last step: mastered)
//   hint     -> the same step again
//   solution -> back to step 0
//
// Only a clean pass ever advances, so mastery always ends on one.

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function at(step: number, today: string): string | null {
  return step < QUESTION_REVIEW_DAYS.length ? addDays(today, QUESTION_REVIEW_DAYS[step]) : null;
}

// A clean solve needs no reviews. Only a solve that took a hint or the
// solution goes on the ladder, starting with a review the next day.
export function scheduleSolve(outcome: ReviewOutcome, today: string): QuestionReview | undefined {
  if (outcome === "clean") return undefined;
  return { step: 0, dueAt: at(0, today), log: [{ at: today, kind: "solve", outcome }] };
}

// Schedules made before that rule, from a clean solve and never reviewed since.
export function isCleanSolveOnly(review: QuestionReview | undefined): boolean {
  return review?.log.length === 1 && review.log[0].kind === "solve" && review.log[0].outcome === "clean";
}

// A question solved before reviews existed has no schedule; reviewing it
// starts one from step 0.
export function applyReview(review: QuestionReview | undefined, outcome: ReviewOutcome, today: string): QuestionReview {
  const current = Math.min(review?.step ?? 0, QUESTION_REVIEW_DAYS.length - 1);
  const step = outcome === "clean" ? current + 1 : outcome === "hint" ? current : 0;
  return { step, dueAt: at(step, today), log: [...(review?.log ?? []), { at: today, kind: "review", outcome }] };
}

export function isReviewDue(p: Pick<QuestionProgressV2, "completed" | "review"> | undefined, today: string): boolean {
  return !!p?.completed && !!p.review?.dueAt && p.review.dueAt <= today;
}

export function isMastered(review: QuestionReview | undefined): boolean {
  return !!review && review.dueAt === null;
}

export function countDue(progress: Record<string, QuestionProgressV2>, today: string, ids?: Set<string>): number {
  let n = 0;
  for (const [id, p] of Object.entries(progress)) if ((!ids || ids.has(id)) && isReviewDue(p, today)) n++;
  return n;
}

// Every row asks "is this one due?", so the set is built once per store.
const dueCache = new WeakMap<AppStoreV2, Set<string>>();
export function dueIds(v2: AppStoreV2, today: string): Set<string> {
  let ids = dueCache.get(v2);
  if (!ids) {
    ids = new Set(Object.keys(v2.progress).filter((id) => isReviewDue(v2.progress[id], today)));
    dueCache.set(v2, ids);
  }
  return ids;
}

export function daysUntil(dueAt: string, today: string): number {
  return Math.round((Date.parse(`${dueAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

// Two devices' schedules for one question: the one with the longer log has
// seen more of its history, so it wins whole -- splicing logs would produce
// a step that neither device ever computed.
export function mergeReview(a: QuestionReview | undefined, b: QuestionReview | undefined): QuestionReview | undefined {
  if (!a || !b) return a ?? b;
  if (a.log.length !== b.log.length) return a.log.length > b.log.length ? a : b;
  return (a.log.at(-1)?.at ?? "") >= (b.log.at(-1)?.at ?? "") ? a : b;
}
