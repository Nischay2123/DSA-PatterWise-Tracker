import { REVISION_CONFIG } from "../config";
import { useFilters, useStore } from "../context";
import { deriveState, isTopicGated } from "../revision/stateMachine";
import { countDone, getState, getTopicRevision, isGatingActive, isProblemVisible } from "../store";
import { cx } from "../cx";
import type { Topic } from "../types";
import { PatternGroup } from "./PatternGroup";
import { ProgressBar } from "./ProgressBar";

function RevisionBanner({ topic }: { topic: Topic }) {
  return (
    <div className="mx-3 mb-2 flex items-center justify-between gap-3 flex-wrap rounded-md bg-accent-soft border border-accent/25 px-3 py-2 text-ui">
      <span className="font-medium">Revision due for {topic.name}.</span>
      <button
        type="button"
        onClick={() => {
          window.location.hash = `#/revision/${encodeURIComponent(topic.id)}`;
        }}
        className="btn btn-sm btn-primary"
      >
        Start revision
      </button>
    </div>
  );
}

function TopicItem({ topic }: { topic: Topic }) {
  const { store, v2Store } = useStore();
  const { filters } = useFilters();

  const allProblems = topic.patterns.flatMap((p) => p.problems);
  const anyVisible = allProblems.some((p) =>
    isProblemVisible(p, getState(store, p.id), filters, { topicName: topic.name, patternName: "" })
  );
  const done = countDone(allProblems, store);
  const total = allProblems.length;

  const isExempt = (REVISION_CONFIG.exemptTopics as readonly string[]).includes(topic.id);
  const revisionState = deriveState(getTopicRevision(v2Store, topic.id), total ? done / total : 0, isExempt);
  // Gating is a policy on top of the derived state: the Settings switch and
  // the no-key rule can both turn it off (see isGatingActive).
  const gated = isTopicGated(revisionState) && isGatingActive(v2Store.settings);

  return (
    <details
      data-accordion
      className={cx("topic group/topic card mb-2 overflow-hidden", !anyVisible && "hidden")}
    >
      <summary
        className="disclosure flex items-center gap-2.5 py-2.5 px-3.5 text-head font-semibold
          hover:bg-row-hover group-open/topic:border-b group-open/topic:border-border
          before:content-['▸'] before:text-muted before:text-ui group-open/topic:before:content-['▾']"
      >
        {topic.name}
        <span className="ml-auto w-20 sm:w-28 shrink-0">
          <ProgressBar done={done} total={total} mini />
        </span>
        <span className="font-normal text-caption text-muted w-14 shrink-0 text-right tabular-nums">
          {`${done}/${total}`}
        </span>
      </summary>
      {gated && <RevisionBanner topic={topic} />}
      {topic.patterns.map((p) => (
        <PatternGroup key={p.id} pattern={p} topicName={topic.name} gated={gated} />
      ))}
    </details>
  );
}

export function TopicList({ topics }: { topics: Topic[] }) {
  return (
    <div>
      {topics.map((t) => (
        <TopicItem key={t.id} topic={t} />
      ))}
    </div>
  );
}
