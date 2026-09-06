import { useFilters, useStore } from "../context";
import { countDone, getState, isProblemVisible } from "../store";
import { cx } from "../cx";
import { resolveGoal } from "../revision/goal";
import type { Pattern } from "../types";
import { FundamentalsPanel } from "./FundamentalsPanel";
import { Icon } from "./Icon";
import { QuestionRow } from "./QuestionRow";

export function PatternGroup({
  pattern,
  topicName,
  gated,
}: {
  pattern: Pattern;
  topicName: string;
  gated: boolean;
}) {
  const { store, v2Store } = useStore();
  const { filters } = useFilters();

  const context = { topicName, patternName: pattern.name, goal: resolveGoal(v2Store.settings) };
  const anyVisible = pattern.problems.some((p) => isProblemVisible(p, getState(store, p.id), filters, context));
  const done = countDone(pattern.problems, store);
  const total = pattern.problems.length;
  const complete = total > 0 && done === total;

  return (
    <details data-accordion className={cx("pattern group/pattern px-2 sm:px-3.5", !anyVisible && "hidden")}>
      <summary className="disclosure flex items-center gap-2 py-2 px-1.5 rounded-lg hover:bg-row-hover">
        <Icon
          name="chevronRight"
          className="size-3.5 text-faint shrink-0 transition-transform group-open/pattern:rotate-90"
        />
        <span
          className={cx(
            "size-1.5 rounded-full shrink-0",
            complete ? "bg-accent" : done > 0 ? "bg-accent/40" : "bg-border-strong"
          )}
          aria-hidden="true"
        />
        <span className="text-ui font-semibold text-muted group-open/pattern:text-fg min-w-0 truncate">
          {pattern.name}
        </span>
        <span
          data-pattern-progress={pattern.id}
          className="chip ml-auto shrink-0 tabular-nums py-0.5 px-1.5"
        >
          {done}/{total}
        </span>
      </summary>
      {/* A guide line so a 30-row pattern stays visually attached to its
          heading while scrolling. */}
      <div className="ml-[7px] border-l border-border pl-3 pb-2 pt-0.5">
        <FundamentalsPanel patternId={pattern.id} />
        {pattern.problems.map((p) => (
          <QuestionRow key={p.id} problem={p} topicName={topicName} patternName={pattern.name} gated={gated} />
        ))}
      </div>
    </details>
  );
}
