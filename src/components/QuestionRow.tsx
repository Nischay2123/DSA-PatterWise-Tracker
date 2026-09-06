import { useState } from "react";
import { useFilters, useStore } from "../context";
import { canCompleteFreely, getState, getV2Progress, hasNotes, isProblemVisible } from "../store";
import { cx } from "../cx";
import { CompletionPanel } from "./CompletionPanel";
import { Icon, type IconName } from "./Icon";
import { MistakeList } from "./MistakeList";
import { NotesEditor } from "./NotesEditor";
import { SolutionEditor } from "./SolutionEditor";
import type { Problem } from "../types";

// Soft tint + coloured text, not a saturated block. 467 of these appear on
// one page; solid badges turned the list into confetti.
export const DIFFICULTY_PILL = {
  Easy: "bg-easy-soft text-easy",
  Medium: "bg-medium-soft text-medium",
  Hard: "bg-hard-soft text-hard",
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

  // Was one dot-joined string in muted 11px. Chips give each fact an edge so
  // the eye can pick out "Importance: High" without reading the whole line.
  const meta: { icon: IconName; text: string }[] = [];
  if (problem.platform && problem.platform !== "-") meta.push({ icon: "external", text: problem.platform });
  if (problem.estMinutes) meta.push({ icon: "clock", text: `${problem.estMinutes} min` });
  if (problem.importance) meta.push({ icon: "target", text: `Importance: ${problem.importance}` });
  if (problem.interviewFreq) meta.push({ icon: "flame", text: `Interview freq: ${problem.interviewFreq}` });
  if (problem.originalStep) meta.push({ icon: "book", text: problem.originalStep });

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
    // .problem-row / data-id / scroll-mt stay on THIS element -- App.tsx's
    // jumpToProblem and useFilterAccordions both select on them, and the
    // filter hook specifically reads the literal `hidden` CLASS.
    <div
      className={cx(
        "problem-row group/row grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1",
        "rounded-lg py-2 px-2.5 -mx-1 scroll-mt-32 transition-colors",
        "hover:bg-row-hover",
        (detailsOpen || completionPanelOpen) && "bg-row-hover",
        !visible && "hidden"
      )}
      data-id={problem.id}
    >
      {/* A real control instead of the UA checkbox: the native input keeps
          every bit of keyboard and screen-reader behaviour, and the styled
          sibling is what anyone actually sees. */}
      <label
        className="mt-px flex cursor-pointer"
        title={
          checkboxBlocked
            ? "Revision due for this topic — complete a revision session to unlock new completions"
            : undefined
        }
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={state.done}
          disabled={checkboxBlocked}
          aria-label={`Mark "${problem.question}" as done`}
          aria-expanded={completionPanelOpen}
          onChange={(e) => handleCheckboxChange(e.target.checked)}
        />
        <span
          className="grid size-[19px] [@media(pointer:coarse)]:size-6 place-items-center rounded-md
            border-[1.5px] border-border-strong bg-surface text-transparent transition-all
            peer-hover:border-accent
            peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-fg
            peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent
            peer-focus-visible:outline-offset-2
            peer-disabled:opacity-35 peer-disabled:cursor-not-allowed peer-disabled:border-border-strong"
        >
          <Icon name="check" className="size-3 [@media(pointer:coarse)]:size-3.5" />
        </span>
      </label>

      <div className="min-w-0 flex items-center gap-2 flex-wrap">
        <span
          className={cx(
            "pill leading-none px-1.5 shrink-0 font-bold tracking-wide",
            DIFFICULTY_PILL[problem.difficulty]
          )}
          title={problem.difficulty}
        >
          {problem.difficulty[0]}
        </span>
        {problem.link ? (
          <a
            className={cx(
              "text-body min-w-0 decoration-accent/40 underline-offset-2 hover:underline hover:text-accent",
              state.done ? "line-through text-faint hover:text-faint" : "text-fg"
            )}
            href={problem.link}
            target="_blank"
            rel="noopener"
          >
            {problem.question}
          </a>
        ) : (
          <span className={cx("text-body min-w-0", state.done ? "line-through text-faint" : "text-fg")}>
            {problem.question}
          </span>
        )}
      </div>

      {/* Actions stay put instead of wrapping: the star and the expander are
          in the same place on every one of 467 rows. */}
      <div className="flex items-center gap-0.5 justify-self-end">
        {notesIndicator && (
          <span className="size-1.5 rounded-full bg-accent mr-1" title="Has saved notes" aria-hidden="true" />
        )}
        <button
          type="button"
          className={cx(
            "icon-btn size-7",
            state.revise
              ? "text-star hover:text-star"
              : "text-faint opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
          )}
          title={state.revise ? "Unstar" : "Star for revision"}
          aria-label="Mark for revision"
          aria-pressed={state.revise}
          onClick={() => dispatch({ type: "TOGGLE_REVISE", id: problem.id })}
        >
          <Icon name="star" className="size-4" filled={state.revise} />
        </button>
        <button
          type="button"
          className={cx("icon-btn size-7", (detailsOpen || notesIndicator) && "text-fg")}
          title={detailsOpen ? "Hide details" : "Show notes, solution and mistakes"}
          aria-label="Toggle details"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((o) => !o)}
        >
          <Icon name="chevronDown" className={cx("size-4 transition-transform", detailsOpen && "rotate-180")} />
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
          <div className={cx("mt-2 border-l-2 border-accent-line pl-3.5", detailsOpen ? "block" : "hidden")}>
            {meta.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {meta.map((m) => (
                  <span key={m.text} className="chip">
                    <Icon name={m.icon} className="size-3" />
                    {m.text}
                  </span>
                ))}
              </div>
            )}
            <SolutionEditor problemId={problem.id} />
            <NotesEditor problemId={problem.id} />
            <MistakeList problemId={problem.id} />
          </div>
        </div>
      )}
    </div>
  );
}
