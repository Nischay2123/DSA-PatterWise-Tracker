import { REVISION_CONFIG } from "../config";
import { useFilters, useStore } from "../context";
import { goalScoped, isDefaultGoal, isTopicOutOfGoalScope, resolveGoal } from "../revision/goal";
import { deriveState, isTopicGated } from "../revision/stateMachine";
import { countDone, getState, getTopicRevision, isGatingActive, isProblemVisible } from "../store";
import { cx } from "../cx";
import type { Topic } from "../types";
import { Icon } from "./Icon";
import { PatternGroup } from "./PatternGroup";
import { Ring } from "./Ring";

function RevisionBanner({ topic }: { topic: Topic }) {
  return (
    <div
      className="mx-3.5 mt-3 mb-1 flex items-center gap-3 flex-wrap rounded-lg border border-accent-line
        bg-accent-soft px-3.5 py-2.5"
    >
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-fg shrink-0">
        <Icon name="repeat" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-ui font-semibold">Revision due for {topic.name}</div>
        <div className="text-micro text-muted">Run a session to unlock new completions in this topic.</div>
      </div>
      <button
        type="button"
        onClick={() => {
          window.location.hash = `#/revision/${encodeURIComponent(topic.id)}`;
        }}
        className="btn btn-sm btn-primary"
      >
        Start revision
        <Icon name="arrowRight" className="size-3.5" />
      </button>
    </div>
  );
}

function TopicItem({ topic, index }: { topic: Topic; index: number }) {
  const { store, v2Store } = useStore();
  const { filters } = useFilters();

  const goal = resolveGoal(v2Store.settings);
  const allProblems = topic.patterns.flatMap((p) => p.problems);
  const anyVisible = allProblems.some((p) =>
    isProblemVisible(p, getState(store, p.id), filters, { topicName: topic.name, patternName: "", goal })
  );

  // "Exempt" here means revision ignores this topic entirely -- either it is
  // on the permanent exempt list, or the goal thinned it below the floor.
  const isExempt =
    (REVISION_CONFIG.exemptTopics as readonly string[]).includes(topic.id) ||
    isTopicOutOfGoalScope(allProblems, goal);

  const inGoal = goalScoped(allProblems, goal);

  // TWO different percentages, and conflating them is a bug waiting to
  // happen. This one feeds the state machine, so it is measured against
  // whatever revision governs this topic and NEVER against what the list
  // happens to be showing -- a view toggle must not move a topic in or out
  // of REVISION_DUE.
  const governedByGoal = !isExempt && !isDefaultGoal(goal);
  const scored = governedByGoal ? inGoal : allProblems;
  const scoredDone = countDone(scored, store);
  const revisionPct = scored.length ? scoredDone / scored.length : 0;
  const revisionState = deriveState(getTopicRevision(v2Store, topic.id), revisionPct, isExempt);

  // This one is display only, and it follows the list: showing 0/14 beside a
  // single visible row is what happens if it does not.
  const shown = !isDefaultGoal(goal) && filters.goalOnly ? inGoal : allProblems;
  const narrowed = shown.length < allProblems.length;
  const done = countDone(shown, store);
  const total = shown.length;
  const pct = total ? done / total : 0;
  const complete = total > 0 && done === total;
  // Gating is a policy on top of the derived state: the Settings switch and
  // the no-key rule can both turn it off (see isGatingActive).
  const gated = isTopicGated(revisionState) && isGatingActive(v2Store.settings);

  return (
    <details
      data-accordion
      className={cx(
        "topic group/topic card mb-2.5 overflow-hidden transition-shadow open:shadow-panel",
        gated && "border-accent-line",
        !anyVisible && "hidden"
      )}
    >
      <summary
        className="disclosure flex items-center gap-3 py-3 px-3.5 hover:bg-row-hover
          group-open/topic:border-b group-open/topic:border-border"
      >
        <Icon
          name="chevronRight"
          className="size-4 text-faint shrink-0 transition-transform group-open/topic:rotate-90"
        />
        {/* A numbered marker gives the list a spine — it was 18 identical
            grey rows of text before. */}
        <span
          className={cx(
            "grid size-6 shrink-0 place-items-center rounded-md text-micro font-bold tabular-nums",
            complete ? "bg-accent text-accent-fg" : "bg-sunken text-faint"
          )}
        >
          {complete ? <Icon name="check" className="size-3.5" /> : index + 1}
        </span>
        <span className="font-display text-head font-bold tracking-tight min-w-0 truncate">{topic.name}</span>
        {gated && (
          <span className="pill bg-accent-soft text-accent shrink-0">
            <Icon name="repeat" className="size-3" />
            <span className="max-sm:hidden">Revision due</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-2.5 shrink-0">
          <span
            className="text-caption text-muted tabular-nums font-medium"
            title={narrowed ? `${done} of ${total} problems in your goal (topic has ${allProblems.length})` : undefined}
          >
            {done}
            <span className="text-faint">/{total}</span>
            {narrowed && <span className="ml-1 text-accent" aria-hidden="true">&#9679;</span>}
          </span>
          <Ring pct={pct} size={30} stroke={3.5} />
        </span>
      </summary>
      {gated && <RevisionBanner topic={topic} />}
      <div className="py-1.5">
        {topic.patterns.map((p) => (
          <PatternGroup key={p.id} pattern={p} topicName={topic.name} gated={gated} />
        ))}
      </div>
    </details>
  );
}

export function TopicList({ topics }: { topics: Topic[] }) {
  return (
    <div>
      {topics.map((t, i) => (
        <TopicItem key={t.id} topic={t} index={i} />
      ))}
    </div>
  );
}
