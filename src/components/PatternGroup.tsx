import { useFilters, useStore } from "../context";
import { countDone, getState, isProblemVisible, todayISO, unmetPrereqs } from "../store";
import type { Prereqs } from "../store";
import { dueIds } from "../revision/questionReview";
import { cx } from "../cx";
import { goalScoped, isFullGoal, resolveGoal } from "../revision/goal";
import type { Pattern } from "../types";
import { FundamentalsPanel } from "./FundamentalsPanel";
import { Icon } from "./Icon";
import { NOTES_BY_ID } from "../notes";
import { QuestionRow } from "./QuestionRow";

export function PatternGroup({
  pattern,
  topicName,
  gated,
  prereqs,
  topicNotes,
}: {
  pattern: Pattern;
  topicName: string;
  topicNotes?: string[];
  gated: boolean;
  prereqs: Prereqs;
}) {
  const { store, v2Store } = useStore();
  const { filters } = useFilters();

  const goal = resolveGoal(v2Store.settings);
  const context = { topicName, patternName: pattern.name, goal, due: dueIds(v2Store, todayISO()) };
  const anyVisible = pattern.problems.some((p) => isProblemVisible(p, getState(store, p.id), filters, context));
  // Display only -- nothing derives from this count. It follows the list so
  // the chip never contradicts the rows underneath it.
  const shown = !isFullGoal(goal) && filters.goalOnly ? goalScoped(pattern.problems, goal) : pattern.problems;
  const done = countDone(shown, store);
  const total = shown.length;
  const complete = total > 0 && done === total;
  // The topic's note named in this pattern's own slug (arrays__two-pointers -> two-pointers), else its first.
  const slug = pattern.id.split("__")[1] ?? "";
  const noteId = topicNotes?.find((id) => slug.includes(id)) ?? topicNotes?.[0];

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
        {noteId && (
          <a
            href={`#/notes/${noteId}`}
            target="_blank"
            rel="noopener"
            className="icon-btn size-6 shrink-0 text-faint hover:text-accent"
            title={`${NOTES_BY_ID[noteId]?.title ?? noteId} notes (new tab)`}
            aria-label={`Open ${pattern.name} notes in a new tab`}
          >
            <Icon name="book" className="size-3.5" />
          </a>
        )}
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
          <QuestionRow
            key={p.id}
            problem={p}
            topicName={topicName}
            patternName={pattern.name}
            gated={gated}
            notes={topicNotes}
            lockedBy={unmetPrereqs(p.needs, prereqs.done).map((id) => prereqs.names[id])}
          />
        ))}
      </div>
    </details>
  );
}
