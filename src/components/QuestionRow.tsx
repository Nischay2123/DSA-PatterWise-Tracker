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
    // Grid, not flex-wrap: a fixed checkbox column, a flexible title that
    // truncates, and an action cluster pinned right that never reflows.
    // .problem-row / data-id / scroll-mt stay on THIS element -- App.tsx's
    // jumpToProblem and useFilterAccordions both select on them.
    <div
      className={cx(
        "problem-row group/row grid grid-cols-[auto_1fr_auto] items-start gap-x-2.5 gap-y-1",
        "py-1.5 px-2 -mx-2 rounded-md border-t border-border/60 first:border-t-0",
        "hover:bg-row-hover scroll-mt-28",
        !visible && "hidden"
      )}
      data-id={problem.id}
    >
      <input
        type="checkbox"
        className="mt-[3px] accent-progress [@media(pointer:coarse)]:w-5 [@media(pointer:coarse)]:h-5 disabled:cursor-not-allowed"
        checked={state.done}
        disabled={checkboxBlocked}
        title={checkboxBlocked ? "Revision due for this topic — complete a revision session to unlock new completions" : undefined}
        aria-label={`Mark "${problem.question}" as done`}
        aria-expanded={completionPanelOpen}
        onChange={(e) => handleCheckboxChange(e.target.checked)}
      />

      <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
        {problem.link ? (
          <a
            className={cx(
              "text-body text-fg hover:text-accent hover:underline underline-offset-2 min-w-0",
              state.done && "line-through text-muted hover:text-muted"
            )}
            href={problem.link}
            target="_blank"
            rel="noopener"
          >
            {problem.question}
          </a>
        ) : (
          // Was missing text-fg, so it rendered muted next to real links.
          <span className={cx("text-body text-fg min-w-0", state.done && "line-through text-muted")}>
            {problem.question}
          </span>
        )}
        <span
          className={cx(
            "text-micro font-medium leading-none py-0.5 px-1.5 rounded text-white whitespace-nowrap",
            BADGE_COLOR[problem.difficulty]
          )}
        >
          {problem.difficulty}
        </span>
      </div>

      <div className="flex items-center gap-0.5 justify-self-end">
        <button
          type="button"
          className={cx(
            "bg-transparent border-0 cursor-pointer text-base leading-none px-1 py-0.5 rounded",
            "hover:bg-border/50 [@media(pointer:coarse)]:p-1.5 [@media(pointer:coarse)]:min-w-8 [@media(pointer:coarse)]:min-h-8",
            state.revise ? "text-star" : "text-muted opacity-70 group-hover/row:opacity-100"
          )}
          title={state.revise ? "Unmark for revision" : "Mark for revision"}
          aria-label="Mark for revision"
          aria-pressed={state.revise}
          onClick={() => dispatch({ type: "TOGGLE_REVISE", id: problem.id })}
        >
          ★
        </button>
        <button
          type="button"
          className={cx(
            "bg-transparent border-0 cursor-pointer text-ui px-1.5 py-0.5 rounded hover:bg-border/50",
            "[@media(pointer:coarse)]:p-1.5 [@media(pointer:coarse)]:min-w-8 [@media(pointer:coarse)]:min-h-8",
            notesIndicator ? "text-fg font-semibold after:content-['_•']" : "text-muted"
          )}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((o) => !o)}
        >
          details
        </button>
      </div>

      {/* Only occupies a grid row when something is actually open -- an
          always-rendered wrapper would add gap-y to every one of 467 rows. */}
      {(completionPanelOpen || detailsOpen) && (
        <div className="col-start-2 col-span-2 min-w-0">
          {completionPanelOpen && (
            <CompletionPanel
              problemId={problem.id}
              onCancel={() => setCompletionPanelOpen(false)}
              onCompleted={() => setCompletionPanelOpen(false)}
            />
          )}
          {/* Kept mounted-but-hidden rather than unmounted: the editors below
              are uncontrolled (defaultValue), so unmounting would discard an
              unblurred draft. */}
          <div className={cx("text-ui text-muted mt-1.5", detailsOpen ? "block" : "hidden")}>
            <div className="mb-2 text-micro">{meta}</div>
            <SolutionEditor problemId={problem.id} />
            <NotesEditor problemId={problem.id} />
            <MistakeList problemId={problem.id} />
          </div>
        </div>
      )}
    </div>
  );
}
