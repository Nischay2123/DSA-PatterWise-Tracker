import { useState } from "react";
import { useStore } from "../../context";
import { buildTopicRows, countDashboard, statusLabel } from "../../revision/dashboard";
import type { TopicRow } from "../../revision/dashboard";
import { getConceptById } from "../../revision/session";
import { cx } from "../../cx";
import { Icon } from "../Icon";
import { Ring } from "../Ring";
import { StatTile } from "../StatTile";
import type { Topic } from "../../types";

// The emoji dot from revision/dashboard.ts is still what the module exports,
// but rendering it left six near-identical circles at the mercy of the
// platform emoji font. Same information, drawn by the design system.
const STATE_TONE: Record<string, string> = {
  MASTERED: "bg-easy",
  REVISION_DUE: "bg-hard",
  REVISION_FAILED: "bg-hard",
  REVISION_IN_PROGRESS: "bg-medium",
  REVISION_SCHEDULED: "bg-accent",
  IN_PROGRESS: "bg-border-strong",
};

export function RevisionDashboard({
  topics,
  onExit,
  onStartRevision,
}: {
  topics: Topic[];
  onExit: () => void;
  onStartRevision: (topicId: string) => void;
}) {
  const { store, v2Store } = useStore();
  const rows = buildTopicRows(topics, store, v2Store);
  const counts = countDashboard(rows);

  return (
    <div className="mx-auto w-full max-w-shell px-4 md:px-6 pt-6 pb-20">
      <div className="flex items-center gap-3 mb-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg shadow-panel">
          <Icon name="repeat" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-title font-bold tracking-tight m-0">Revision</h1>
          <p className="text-caption text-muted m-0">Spaced repetition across every topic</p>
        </div>
        <button type="button" onClick={onExit} className="btn">
          <Icon name="chevronLeft" className="size-4" />
          <span className="max-sm:hidden">Back to tracker</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
        <StatTile value={counts.dueToday} label="due today" icon="calendar" tone="accent" />
        <StatTile value={counts.overdue} label="overdue" icon="alert" tone="hard" />
        <StatTile value={counts.upcoming} label="upcoming" icon="clock" />
        <StatTile value={counts.strong} label="strong" icon="check" tone="accent" />
        <StatTile value={counts.weak} label="weak" icon="target" tone="star" />
        <StatTile value={counts.mastered} label="mastered" icon="sparkle" tone="accent" />
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <TopicCard
            key={row.topicId}
            row={row}
            onStartRevision={onStartRevision}
            questionTitles={titlesForTopic(topics, row.topicId)}
          />
        ))}
      </div>

      <p className="text-micro text-faint mt-6 mb-0 flex items-center gap-1.5">
        <Icon name="alert" className="size-3.5 shrink-0" />
        The fundamentals topic is exempt from revision, so it isn't counted here.
      </p>
    </div>
  );
}

// weakConcepts is keyed by concept id OR question id (plan §6), so the weak
// list has to be able to name both -- otherwise a weak question shows up as
// a raw slug.
function titlesForTopic(topics: Topic[], topicId: string): Map<string, string> {
  const topic = topics.find((t) => t.id === topicId);
  return new Map(topic?.patterns.flatMap((p) => p.problems.map((q) => [q.id, q.question] as const)) ?? []);
}

function TopicCard({
  row,
  onStartRevision,
  questionTitles,
}: {
  row: TopicRow;
  onStartRevision: (topicId: string) => void;
  questionTitles: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const gated = row.state === "REVISION_DUE" || row.state === "REVISION_FAILED";

  return (
    <div className={cx("card overflow-hidden", gated && "border-accent-line")}>
      <div className="flex items-center gap-3 py-3 px-3.5 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 min-w-0 flex-1 bg-transparent border-0 p-0 cursor-pointer text-left"
          aria-expanded={open}
        >
          <Icon
            name="chevronRight"
            className={cx("size-4 text-faint shrink-0 transition-transform", open && "rotate-90")}
          />
          <span
            className={cx("size-2 shrink-0 rounded-full", STATE_TONE[row.state] ?? "bg-border-strong")}
            aria-hidden="true"
          />
          <span className="font-display text-head font-bold tracking-tight truncate">{row.name}</span>
          <span className="text-caption text-muted truncate max-sm:hidden">{statusLabel(row)}</span>
        </button>

        <span className="flex items-center gap-2.5 shrink-0">
          {row.lastScore !== null && (
            <span className="pill bg-sunken text-muted tabular-nums">last {row.lastScore}/100</span>
          )}
          {row.lastScore === null && row.history.length > 0 && (
            <span className="pill bg-sunken text-muted">self-assessed</span>
          )}
          <Ring pct={row.completionPct} size={28} stroke={3.5} />
          {gated && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => onStartRevision(row.topicId)}>
              Start
              <Icon name="arrowRight" className="size-3.5" />
            </button>
          )}
        </span>
        <span className="text-caption text-muted sm:hidden basis-full">{statusLabel(row)}</span>
      </div>

      {open && (
        <div className="border-t border-border bg-sunken px-3.5 py-3.5 text-caption text-muted">
          <div className="flex flex-wrap gap-1.5 mb-3.5">
            <span className="chip">{Math.round(row.completionPct * 100)}% complete</span>
            <span className="chip">
              {row.cycle} passed cycle{row.cycle === 1 ? "" : "s"}
            </span>
            {row.nextDueAt && (
              <span className="chip">
                <Icon name="calendar" className="size-3" />
                next due {row.nextDueAt}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="field-label">History</div>
              {row.history.length === 0 ? (
                <div>No revisions yet.</div>
              ) : (
                <ul className="list-none p-0 m-0 flex flex-col gap-1">
                  {[...row.history].reverse().map((h) => (
                    <li key={h.attemptId} className="flex items-center gap-2 tabular-nums">
                      <span
                        className={cx(
                          "size-1.5 rounded-full shrink-0",
                          h.selfAssessed ? "bg-border-strong" : h.passed ? "bg-easy" : "bg-hard"
                        )}
                        aria-hidden="true"
                      />
                      <span className="text-fg">{h.at}</span>
                      {h.selfAssessed ? "marked done (not graded)" : `${h.passed ? "passed" : "failed"} · ${h.score}/100`}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="field-label">Weak areas</div>
              {row.weakConcepts.length === 0 ? (
                <div>Nothing flagged yet.</div>
              ) : (
                <ul className="list-none p-0 m-0 flex flex-col gap-1">
                  {row.weakConcepts.slice(0, 8).map((w) => (
                    <li key={w.id} className="flex items-start gap-2">
                      <span className="pill bg-star-soft text-star shrink-0 tabular-nums px-1.5">×{w.weight}</span>
                      <span className="min-w-0">
                        {getConceptById(w.id)?.prompt ?? questionTitles.get(w.id) ?? w.id}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
