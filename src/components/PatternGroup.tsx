import { useFilters, useStore } from "../context";
import { countDone, getState, isProblemVisible } from "../store";
import { cx } from "../cx";
import type { Pattern } from "../types";
import { FundamentalsPanel } from "./FundamentalsPanel";
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
  const { store } = useStore();
  const { filters } = useFilters();

  const context = { topicName, patternName: pattern.name };
  const anyVisible = pattern.problems.some((p) => isProblemVisible(p, getState(store, p.id), filters, context));
  const done = countDone(pattern.problems, store);
  const total = pattern.problems.length;

  return (
    <details
      data-accordion
      className={cx("pattern group/pattern px-3.5 sm:pl-7", !anyVisible && "hidden")}
    >
      <summary
        className="disclosure flex items-center gap-2 py-2 text-ui text-muted font-semibold
          hover:text-fg before:content-['▸'] before:text-micro group-open/pattern:before:content-['▾']"
      >
        {pattern.name}
        <span data-pattern-progress={pattern.id} className="text-caption tabular-nums opacity-70">
          {done}/{total}
        </span>
      </summary>
      <div className="pb-1.5">
        <FundamentalsPanel patternId={pattern.id} />
        {pattern.problems.map((p) => (
          <QuestionRow key={p.id} problem={p} topicName={topicName} patternName={pattern.name} gated={gated} />
        ))}
      </div>
    </details>
  );
}
