import { useFilters, useStore } from "../context";
import { countDone, getState, isProblemVisible } from "../store";
import { cx } from "../cx";
import type { Topic } from "../types";
import { PatternGroup } from "./PatternGroup";
import { ProgressBar } from "./ProgressBar";

function TopicItem({ topic }: { topic: Topic }) {
  const { store } = useStore();
  const { filters } = useFilters();

  const allProblems = topic.patterns.flatMap((p) => p.problems);
  const anyVisible = allProblems.some((p) =>
    isProblemVisible(p, getState(store, p.id), filters, { topicName: topic.name, patternName: "" })
  );
  const done = countDone(allProblems, store);
  const total = allProblems.length;

  return (
    <details
      data-accordion
      className={cx("topic group/topic border border-border rounded-lg mb-2.5", !anyVisible && "hidden")}
    >
      <summary
        className="flex items-center gap-2.5 py-2.5 px-3.5 font-semibold cursor-pointer list-none
          [&::-webkit-details-marker]:hidden before:content-['▸'] before:mr-1.5 group-open/topic:before:content-['▾']"
      >
        {topic.name}
        <span className="ml-auto w-[90px] shrink-0">
          <ProgressBar done={done} total={total} mini />
        </span>
        <span className="font-normal text-[0.8rem] text-muted w-[52px] shrink-0 text-right tabular-nums">
          {`${done}/${total}`}
        </span>
      </summary>
      {topic.patterns.map((p) => (
        <PatternGroup key={p.id} pattern={p} topicName={topic.name} />
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
