import { useState } from "react";
import { useStore } from "../../context";
import { buildTopicRows, countDashboard, statusDot, statusLabel } from "../../revision/dashboard";
import type { TopicRow } from "../../revision/dashboard";
import { getConceptById } from "../../revision/session";
import { StatTile } from "../StatTile";
import type { Topic } from "../../types";


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
    <div className="mx-auto w-full max-w-shell px-4 md:px-6 pt-6 pb-16">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-title font-semibold tracking-tight m-0">Revision</h1>
        <button type="button" onClick={onExit} className="btn-link text-ui">
          Back to tracker
        </button>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        <StatTile value={counts.dueToday} label="due today" />
        <StatTile value={counts.overdue} label="overdue" />
        <StatTile value={counts.upcoming} label="upcoming" />
        <StatTile value={counts.strong} label="strong" />
        <StatTile value={counts.weak} label="weak" />
        <StatTile value={counts.mastered} label="mastered" />
      </div>

      {rows.map((row) => (
        <TopicCard
          key={row.topicId}
          row={row}
          onStartRevision={onStartRevision}
          questionTitles={titlesForTopic(topics, row.topicId)}
        />
      ))}

      <p className="text-micro text-muted mt-5 mb-0">
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
    <div className="card mb-2">
      <div className="flex items-center gap-2.5 py-2.5 px-3.5 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="bg-transparent border-0 p-0 font-[inherit] text-fg cursor-pointer text-left flex items-center gap-2 text-head font-semibold hover:text-accent"
          aria-expanded={open}
        >
          <span aria-hidden="true">{statusDot(row)}</span>
          <span className="font-semibold">{row.name}</span>
        </button>
        <span className="text-ui text-muted">{statusLabel(row)}</span>
        <span className="ml-auto flex items-center gap-2.5">
          {row.lastScore !== null && <span className="text-caption text-muted tabular-nums">last {row.lastScore}/100</span>}
          {row.lastScore === null && row.history.length > 0 && (
            <span className="text-caption text-muted">self-assessed</span>
          )}
          {gated && (
            <button type="button" className="btn" onClick={() => onStartRevision(row.topicId)}>
              Start revision
            </button>
          )}
        </span>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1 text-caption text-muted border-t border-border">
          <div className="mb-2">
            {Math.round(row.completionPct * 100)}% complete · {row.cycle} passed cycle{row.cycle === 1 ? "" : "s"}
            {row.nextDueAt && ` · next due ${row.nextDueAt}`}
          </div>

          <div className="field-label mt-2.5">History</div>
          {row.history.length === 0 ? (
            <div className="mb-2">No revisions yet.</div>
          ) : (
            <ul className="list-none p-0 m-0 mb-2">
              {[...row.history].reverse().map((h) => (
                <li key={h.attemptId} className="tabular-nums">
                  {h.at} — {h.selfAssessed ? "marked done (not graded)" : `${h.passed ? "passed" : "failed"} at ${h.score}/100`}
                </li>
              ))}
            </ul>
          )}

          <div className="field-label mt-3">Weak areas</div>
          {row.weakConcepts.length === 0 ? (
            <div>Nothing flagged yet.</div>
          ) : (
            <ul className="list-none p-0 m-0">
              {row.weakConcepts.slice(0, 8).map((w) => (
                <li key={w.id}>
                  {getConceptById(w.id)?.prompt ?? questionTitles.get(w.id) ?? w.id}{" "}
                  <span className="tabular-nums">×{w.weight}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
