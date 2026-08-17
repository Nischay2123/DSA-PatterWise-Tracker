import { useState } from "react";
import { useFilters, useStore } from "../context";
import { getState, isProblemVisible } from "../store";
import { cx } from "../cx";
import type { Problem } from "../types";

const BADGE_COLOR = {
  Easy: "bg-badge-easy",
  Medium: "bg-badge-medium",
  Hard: "bg-badge-hard",
} as const;

export function QuestionRow({
  problem,
  topicName,
  patternName,
}: {
  problem: Problem;
  topicName: string;
  patternName: string;
}) {
  const { store, dispatch } = useStore();
  const { filters } = useFilters();
  const [notesOpen, setNotesOpen] = useState(false);
  const state = getState(store, problem.id);
  const visible = isProblemVisible(problem, state, filters, { topicName, patternName });
  const hasNotes = !!state.notes.trim();

  const meta = [
    problem.platform && problem.platform !== "-" ? problem.platform : null,
    problem.estMinutes ? `${problem.estMinutes} min` : null,
    problem.importance ? `Importance: ${problem.importance}` : null,
    problem.interviewFreq ? `Interview freq: ${problem.interviewFreq}` : null,
    problem.originalStep || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cx(
        "problem-row flex items-start gap-2 py-1.5 border-t border-row-hover hover:bg-row-hover scroll-mt-40",
        !visible && "hidden"
      )}
      data-id={problem.id}
    >
      <input
        type="checkbox"
        className="mt-[3px] [@media(pointer:coarse)]:w-5 [@media(pointer:coarse)]:h-5"
        checked={state.done}
        aria-label={`Mark "${problem.question}" as done`}
        onChange={(e) => dispatch({ type: "TOGGLE_DONE", id: problem.id, done: e.target.checked })}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {problem.link ? (
            <a
              className={cx(
                "cursor-pointer hover:underline text-fg",
                state.done && "line-through text-muted"
              )}
              href={problem.link}
              target="_blank"
              rel="noopener"
            >
              {problem.question}
            </a>
          ) : (
            <span className={cx("cursor-pointer hover:underline", state.done && "line-through text-muted")}>
              {problem.question}
            </span>
          )}
          <span
            className={cx(
              "text-[0.7rem] py-px px-[7px] rounded-[10px] text-white whitespace-nowrap",
              BADGE_COLOR[problem.difficulty]
            )}
          >
            {problem.difficulty}
          </span>
          <button
            className={cx(
              "bg-transparent border-0 cursor-pointer text-base p-0 [@media(pointer:coarse)]:p-1.5 [@media(pointer:coarse)]:min-w-8 [@media(pointer:coarse)]:min-h-8",
              state.revise ? "text-[#e0a300]" : "text-muted"
            )}
            title={state.revise ? "Unmark for revision" : "Mark for revision"}
            aria-label="Mark for revision"
            aria-pressed={state.revise}
            onClick={() => dispatch({ type: "TOGGLE_REVISE", id: problem.id })}
          >
            ★
          </button>
          <button
            className={cx(
              "bg-transparent border-0 cursor-pointer text-[0.85rem] p-0 [@media(pointer:coarse)]:p-1.5 [@media(pointer:coarse)]:min-w-8 [@media(pointer:coarse)]:min-h-8",
              hasNotes ? "text-fg font-semibold after:content-['_•']" : "text-muted"
            )}
            onClick={() => setNotesOpen((o) => !o)}
          >
            notes
          </button>
        </div>
        <div className={cx("text-[0.78rem] text-muted mt-1", notesOpen ? "block" : "hidden")}>
          <div>{meta}</div>
          <textarea
            key={problem.id}
            defaultValue={state.notes}
            placeholder="Notes..."
            className="w-full min-h-[40px] mt-1 font-[inherit] text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base"
            onBlur={(e) => dispatch({ type: "SET_NOTES", id: problem.id, notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
