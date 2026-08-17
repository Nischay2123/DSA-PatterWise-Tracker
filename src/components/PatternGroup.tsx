import { useFilters, useStore } from "../context";
import { countDone, getState, isProblemVisible } from "../store";
import { cx } from "../cx";
import type { Pattern } from "../types";
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
      className={cx("pattern group/pattern pt-0.5 pr-3.5 pb-0.5 pl-[30px]", !anyVisible && "hidden")}
    >
      <summary
        className="group-open/pattern:mb-0.5 flex items-center gap-2 py-1.5 text-[0.85rem] text-muted font-semibold cursor-pointer list-none
          [&::-webkit-details-marker]:hidden before:content-['▸'] before:mr-1.5 group-open/pattern:before:content-['▾']"
      >
        {pattern.name} <span data-pattern-progress={pattern.id}>{`${done}/${total}`}</span>
      </summary>
      <div className="pl-3">
        {pattern.problems.map((p) => (
          <QuestionRow key={p.id} problem={p} topicName={topicName} patternName={pattern.name} gated={gated} />
        ))}
      </div>
    </details>
  );
}
