import { useState } from "react";
import { useFilters, useStore } from "../context";
import { canCompleteFreely, getState, getV2Progress, hasNotes, isProblemVisible } from "../store";
import { cx } from "../cx";
import { CompletionPanel } from "./CompletionPanel";
import { MistakeList } from "./MistakeList";
import { NotesEditor } from "./NotesEditor";
import { SolutionEditor } from "./SolutionEditor";
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
  gated,
}: {
  problem: Problem;
  topicName: string;
  patternName: string;
  gated: boolean;
}) {
  const { store, dispatch, v2Store } = useStore();
  const { filters } = useFilters();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false);
  const state = getState(store, problem.id);
  const progress = getV2Progress(v2Store, problem.id);
  const visible = isProblemVisible(problem, state, filters, { topicName, patternName });
  const notesIndicator = hasNotes(progress);
  // Gating blocks only a NEW completion (plan §6) -- un-completing, and
  // everything else on an already-done question, stays free.
  const checkboxBlocked = gated && !state.done;

  const meta = [
    problem.platform && problem.platform !== "-" ? problem.platform : null,
    problem.estMinutes ? `${problem.estMinutes} min` : null,
    problem.importance ? `Importance: ${problem.importance}` : null,
    problem.interviewFreq ? `Interview freq: ${problem.interviewFreq}` : null,
    problem.originalStep || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleCheckboxChange = (checked: boolean) => {
    if (!checked) {
      // Un-checking is always free -- no gate, no panel.
      dispatch({ type: "TOGGLE_DONE", id: problem.id, done: false });
      return;
    }
    if (canCompleteFreely(progress, v2Store.settings)) {
      dispatch({ type: "TOGGLE_DONE", id: problem.id, done: true });
    } else {
      setCompletionPanelOpen(true);
    }
  };

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
        className="mt-[3px] [@media(pointer:coarse)]:w-5 [@media(pointer:coarse)]:h-5 disabled:cursor-not-allowed"
        checked={state.done}
        disabled={checkboxBlocked}
        title={checkboxBlocked ? "Revision due for this topic — complete a revision session to unlock new completions" : undefined}
        aria-label={`Mark "${problem.question}" as done`}
        aria-expanded={completionPanelOpen}
        onChange={(e) => handleCheckboxChange(e.target.checked)}
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
              notesIndicator ? "text-fg font-semibold after:content-['_•']" : "text-muted"
            )}
            onClick={() => setDetailsOpen((o) => !o)}
          >
            details
          </button>
        </div>
        {completionPanelOpen && (
          <CompletionPanel
            problemId={problem.id}
            onCancel={() => setCompletionPanelOpen(false)}
            onCompleted={() => setCompletionPanelOpen(false)}
          />
        )}
        <div className={cx("text-[0.78rem] text-muted mt-1", detailsOpen ? "block" : "hidden")}>
          <div className="mb-2">{meta}</div>
          <SolutionEditor problemId={problem.id} />
          <NotesEditor problemId={problem.id} />
          <MistakeList problemId={problem.id} />
        </div>
      </div>
    </div>
  );
}
