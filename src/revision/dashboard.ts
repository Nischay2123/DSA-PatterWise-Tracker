import { REVISION_CONFIG } from "../config";
import type { AppStoreV2, ProgressStore, Topic } from "../types";
import { daysBetweenUTC, todayISOUTC } from "./dates";
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
  history: { at: string; score: number; passed: boolean; attemptId: string }[];
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

function completionPct(topic: Topic, store: ProgressStore): number {
  const problems = topic.patterns.flatMap((p) => p.problems);
  if (!problems.length) return 0;
  const done = problems.filter((p) => store.problems[p.id]?.done).length;
  return done / problems.length;
}

export function isExemptTopic(topicId: string): boolean {
  return (REVISION_CONFIG.exemptTopics as readonly string[]).includes(topicId);
}

// Exempt topics are omitted entirely (plan §5: "never scheduled, never
// gated, omitted from every dashboard count"), so they never appear here.
export function buildTopicRows(
  topics: Topic[],
  store: ProgressStore,
  v2: AppStoreV2,
  now: Date = new Date()
): TopicRow[] {
  const today = todayISOUTC(now);

  return topics
    .filter((t) => !isExemptTopic(t.id))
    .map((topic) => {
      const revision = v2.revision[topic.id];
      const pct = completionPct(topic, store);
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
        history,
        weakConcepts: Object.entries(revision?.weakConcepts ?? {})
          .map(([id, weight]) => ({ id, weight }))
          .sort((a, b) => b.weight - a.weight),
      };
    });
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

    const lastGraded = row.history[row.history.length - 1];
    if (lastGraded) {
      if (lastGraded.passed) counts.strong++;
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
