import { REVISION_CONFIG } from "../config";
import type { TopicRevision } from "../types";
import { addDaysUTC, todayISOUTC } from "./dates";

// Called once, the moment a topic's completion first crosses
// REVISION_CONFIG.completionThreshold (plan §5's "schedule created" step).
// cycle is 0 at this point, so this is intervalDays[0] -- distinct from the
// post-pass advance below, which indexes by the *new* cycle.
export function scheduleInitial(now: Date = new Date()): string {
  return addDaysUTC(todayISOUTC(now), REVISION_CONFIG.intervalDays[0]);
}

export function incrementWeakConcepts(current: Record<string, number>, ids: string[]): Record<string, number> {
  if (!ids.length) return current;
  const next = { ...current };
  for (const id of ids) next[id] = (next[id] ?? 0) + 1;
  return next;
}

export interface AttemptOutcome {
  passed: boolean;
  score: number;
  attemptId: string;
  // Concept/question ids that scored poorly in this attempt -- fed into
  // weakConcepts regardless of pass/fail (plan §8's weighting formula reads
  // weakConcepts to boost future selection, independent of the pass/fail
  // interval advance below).
  weakConceptIds?: string[];
}

// Interval advance (plan §6): pass -> cycle++, nextDueAt = now +
// intervalDays[min(cycle, len-1)]. Fail -> cycle and nextDueAt unchanged
// (stays due, retry immediately available), weak concepts still recorded.
// Either way the session that produced this outcome is now concluded.
export function recordAttemptOutcome(
  topicRevision: TopicRevision,
  outcome: AttemptOutcome,
  now: Date = new Date()
): TopicRevision {
  const nowIso = todayISOUTC(now);
  const history = [
    ...topicRevision.history,
    { at: nowIso, score: outcome.score, passed: outcome.passed, attemptId: outcome.attemptId },
  ];
  const weakConcepts = incrementWeakConcepts(topicRevision.weakConcepts, outcome.weakConceptIds ?? []);

  if (!outcome.passed) {
    return {
      ...topicRevision,
      activeSessionId: null,
      lastFailedAt: nowIso,
      history,
      weakConcepts,
    };
  }

  const cycle = topicRevision.cycle + 1;
  const intervalIndex = Math.min(cycle, REVISION_CONFIG.intervalDays.length - 1);
  return {
    ...topicRevision,
    activeSessionId: null,
    cycle,
    nextDueAt: addDaysUTC(nowIso, REVISION_CONFIG.intervalDays[intervalIndex]),
    lastPassedAt: nowIso,
    history,
    weakConcepts,
  };
}
