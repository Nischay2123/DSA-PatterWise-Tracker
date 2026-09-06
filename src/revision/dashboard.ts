import { REVISION_CONFIG } from "../config";
import type { AppStoreV2, ProgressStore, Topic, TopicRevision } from "../types";
import { daysBetweenUTC, todayISOUTC } from "./dates";
import { goalScoped, isExemptTopic, isTopicOutOfGoalScope, resolveGoal } from "./goal";
import type { Goal } from "./goal";
import { deriveState } from "./stateMachine";
import type { RevisionState } from "./stateMachine";

// Everything the revision dashboard renders, derived rather than stored --
// same rule as the state machine itself (locked decision #5). Pure, so the
// counts the UI shows are the counts the tests assert.

export interface TopicRow {
  topicId: string;
  name: string;
  state: RevisionState;
  completionPct: number;
  cycle: number;
  nextDueAt: string | null;
  // Negative = overdue by that many days. null when nothing is scheduled.
  daysUntilDue: number | null;
  lastScore: number | null;
  /** Solved problems inside the goal scope -- the material a session draws
   *  from, which is what decides whether one can run at all. */
  completedInScope: number;
  history: TopicRevision["history"];
  weakConcepts: { id: string; weight: number }[];
}

export interface DashboardCounts {
  dueToday: number;
  overdue: number;
  upcoming: number;
  strong: number;
  weak: number;
  mastered: number;
}

// The denominator is the GOAL scope, not the whole topic -- that is the
// entire mechanism by which a goal makes revision unlock sooner. Under the
// default goal every problem matches, so this is byte-identical to before.
function completionPct(topic: Topic, store: ProgressStore, goal: Goal): number {
  const problems = goalScoped(topic.patterns.flatMap((p) => p.problems), goal);
  if (!problems.length) return 0;
  const done = problems.filter((p) => store.problems[p.id]?.done).length;
  return done / problems.length;
}

// Re-exported so existing importers (and their tests) keep working.
export { isExemptTopic };

// Exempt topics are omitted entirely (plan §5: "never scheduled, never
// gated, omitted from every dashboard count"), so they never appear here.
export function buildTopicRows(
  topics: Topic[],
  store: ProgressStore,
  v2: AppStoreV2,
  now: Date = new Date()
): TopicRow[] {
  const today = todayISOUTC(now);
  const goal = resolveGoal(v2.settings);

  return topics
    .filter((t) => !isExemptTopic(t.id))
    // A topic the goal leaves too thin to schedule against is omitted for
    // exactly the same reason an exempt topic is -- see GOAL_MIN_TOPIC_PROBLEMS.
    .filter((t) => !isTopicOutOfGoalScope(t.patterns.flatMap((p) => p.problems), goal))
    .map((topic) => {
      const revision = v2.revision[topic.id];
      const inScope = goalScoped(topic.patterns.flatMap((p) => p.problems), goal);
      const completedInScope = inScope.filter((p) => store.problems[p.id]?.done).length;
      const pct = completionPct(topic, store, goal);
      const state = deriveState(
        revision ?? {
          topicId: topic.id,
          cycle: 0,
          nextDueAt: null,
          lastPassedAt: null,
          lastFailedAt: null,
          activeSessionId: null,
          history: [],
          weakConcepts: {},
        },
        pct,
        false,
        now
      );
      const history = revision?.history ?? [];
      const last = history[history.length - 1];

      return {
        topicId: topic.id,
        name: topic.name,
        state,
        completionPct: pct,
        cycle: revision?.cycle ?? 0,
        nextDueAt: revision?.nextDueAt ?? null,
        daysUntilDue: revision?.nextDueAt ? daysBetweenUTC(today, revision.nextDueAt) : null,
        lastScore: last?.score ?? null,
        completedInScope,
        history,
        weakConcepts: Object.entries(revision?.weakConcepts ?? {})
          .map(([id, weight]) => ({ id, weight }))
          .sort((a, b) => b.weight - a.weight),
      };
    });
}

// Whether a session can be started by hand right now. Deliberately NOT
// gated on completionThreshold: that threshold decides when the scheduler
// starts nagging you, which is a different question from whether you are
// allowed to revise something you already know you are shaky on.
export function canReviseManually(row: TopicRow): boolean {
  return row.completedInScope >= REVISION_CONFIG.manualRevisionMinCompleted;
}

// How many more solved problems a topic needs before that becomes true.
export function problemsUntilRevisable(row: TopicRow): number {
  return Math.max(0, REVISION_CONFIG.manualRevisionMinCompleted - row.completedInScope);
}

// The six headline counts. "Strong"/"Weak" are the plan's words without a
// definition attached, so they're pinned to the only hard evidence available:
// whether the most recent GRADED attempt passed. A topic with no graded
// history is neither -- it's just unstarted or unevaluated, and counting it
// as "strong" would be flattering, "weak" would be unfair.
export function countDashboard(rows: TopicRow[]): DashboardCounts {
  const counts: DashboardCounts = { dueToday: 0, overdue: 0, upcoming: 0, strong: 0, weak: 0, mastered: 0 };

  for (const row of rows) {
    if (row.state === "MASTERED") counts.mastered++;

    if (row.state === "REVISION_DUE" || row.state === "REVISION_FAILED") {
      // daysUntilDue < 0 means the due date has already passed. A topic that
      // crossed the threshold but was never scheduled (nextDueAt null) counts
      // as due today rather than overdue -- it has no missed date yet.
      if (row.daysUntilDue !== null && row.daysUntilDue < 0) counts.overdue++;
      else counts.dueToday++;
    }

    if (row.state === "REVISION_SCHEDULED") counts.upcoming++;

    // Only a GRADED attempt counts toward strong/weak. A self-assessed
    // revision says the user did the work, not that anything checked it.
    const last = row.history[row.history.length - 1];
    if (last && !last.selfAssessed) {
      if (last.passed) counts.strong++;
      else counts.weak++;
    }
  }

  return counts;
}

// 🔴 due/overdue, 🟡 due within a couple of days, 🟢 comfortably scheduled or
// mastered, ⚪ not yet in the revision cycle at all.
export function statusDot(row: TopicRow): string {
  if (row.state === "MASTERED") return "🟢";
  if (row.state === "REVISION_DUE" || row.state === "REVISION_FAILED") return "🔴";
  if (row.state === "REVISION_IN_PROGRESS") return "🟡";
  if (row.state === "REVISION_SCHEDULED") return row.daysUntilDue !== null && row.daysUntilDue <= 2 ? "🟡" : "🟢";
  return "⚪";
}

export function statusLabel(row: TopicRow): string {
  switch (row.state) {
    case "MASTERED":
      return "Mastered";
    case "REVISION_FAILED":
      return "Revision due (last attempt failed)";
    case "REVISION_DUE":
      return row.daysUntilDue !== null && row.daysUntilDue < 0
        ? `Overdue by ${Math.abs(row.daysUntilDue)} day${Math.abs(row.daysUntilDue) === 1 ? "" : "s"}`
        : "Revision due";
    case "REVISION_IN_PROGRESS":
      return "Session in progress";
    case "REVISION_SCHEDULED": {
      const d = row.daysUntilDue;
      if (d === null) return "Scheduled";
      if (d <= 0) return "Due today";
      if (d === 1) return "Due tomorrow";
      return `Next in ${d} days`;
    }
    case "IN_PROGRESS":
      return `In progress — ${Math.round(row.completionPct * 100)}%`;
    default:
      return "Not started";
  }
}
