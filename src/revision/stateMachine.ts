import { REVISION_CONFIG } from "../config";
import type { TopicRevision } from "../types";

export type RevisionState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "REVISION_SCHEDULED"
  | "REVISION_DUE"
  | "REVISION_IN_PROGRESS"
  | "REVISION_FAILED"
  | "MASTERED";

// Derived, never stored (plan §6). Precedence, highest first -- the plan's
// state table doesn't say what wins when more than one condition holds at
// once, so this is made explicit and tested exhaustively:
//   REVISION_IN_PROGRESS > MASTERED > REVISION_FAILED > REVISION_DUE
//   > REVISION_SCHEDULED > IN_PROGRESS > NOT_STARTED
// An active session always wins (the user is mid-flow, not merely "due").
// Mastery is checked next as the terminal achievement. A due topic whose
// last attempt failed reports FAILED rather than a generic DUE.
export function deriveState(
  topicRevision: TopicRevision,
  completionPct: number,
  isExempt: boolean,
  now: Date = new Date()
): RevisionState {
  // Exempt topics (plan §5: REVISION_CONFIG.exemptTopics) are permanently
  // NOT_STARTED/IN_PROGRESS -- never scheduled, never gated -- regardless of
  // anything recorded in topicRevision.
  if (isExempt) {
    return completionPct > 0 ? "IN_PROGRESS" : "NOT_STARTED";
  }

  if (topicRevision.activeSessionId !== null) return "REVISION_IN_PROGRESS";
  if (topicRevision.cycle >= REVISION_CONFIG.masteryCycles && completionPct >= 1) return "MASTERED";

  if (completionPct <= 0) return "NOT_STARTED";
  if (completionPct < REVISION_CONFIG.completionThreshold) return "IN_PROGRESS";

  // completionPct >= threshold from here on -- scheduled or due.
  const nowIso = now.toISOString().slice(0, 10);
  const isDue = topicRevision.nextDueAt === null || nowIso >= topicRevision.nextDueAt;
  if (!isDue) return "REVISION_SCHEDULED";

  const lastAttempt = topicRevision.history[topicRevision.history.length - 1];
  if (lastAttempt && !lastAttempt.passed) return "REVISION_FAILED";
  return "REVISION_DUE";
}

// Gating scope, precise (plan §6): only these two states block a NEW
// completion in the topic. Everything else -- viewing, un-completing,
// starring, notes, other topics -- is always allowed regardless of state.
export function isTopicGated(state: RevisionState): boolean {
  return state === "REVISION_DUE" || state === "REVISION_FAILED";
}
