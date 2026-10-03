import { useState } from "react";
import { useFilters, useStore } from "../context";
import { SOURCES } from "../config";
import { problemLink, siteLabel } from "../links";
import { isDefaultGoal, matchesGoal, resolveGoal } from "../revision/goal";
import { daysUntil, dueIds, isMastered } from "../revision/questionReview";
import { canCompleteFreely, getState, getV2Progress, hasNotes, isProblemVisible, todayISO } from "../store";
import { cx } from "../cx";
import { CompletionPanel } from "./CompletionPanel";
import { Icon, type IconName } from "./Icon";
import { MistakeList } from "./MistakeList";
import { NotesEditor } from "./NotesEditor";
import { ReviewOutcomeButtons } from "./ReviewOutcome";
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
  lockedBy = [],
}: {
  problem: Problem;
  topicName: string;
  patternName: string;
  gated: boolean;
  /** Names of the unfinished topics this problem builds on. */
  lockedBy?: string[];
}) {
  const { store, dispatch, v2Store, dispatchV2 } = useStore();
  const { filters } = useFilters();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completionPanelOpen, setCompletionPanelOpen] = useState(false);
  // "solve" right after a free tick, "review" from the due pill.
  const [asking, setAsking] = useState<"solve" | "review" | null>(null);
  const state = getState(store, problem.id);
  const link = problemLink(problem);
  const links = [...(link ? [[siteLabel(link), link]] : []), ...Object.entries(problem.alt ?? {})];
  const progress = getV2Progress(v2Store, problem.id);
  const goal = resolveGoal(v2Store.settings);
  const today = todayISO();
  const due = dueIds(v2Store, today);
  const visible = isProblemVisible(problem, state, filters, { topicName, patternName, goal, due });
  const review = state.done ? progress.review : undefined;
  const reviewDue = due.has(problem.id);
  // Marks the rows that count toward the goal -- but only while the list is
  // showing everything. With the list already scoped to the goal, every
  // visible row would carry one, which says nothing.
  const inGoal = !isDefaultGoal(goal) && !filters.goalOnly && matchesGoal(problem, goal);
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
  if (review?.dueAt) meta.push({ icon: "bell", text: `Next review ${review.dueAt}` });
  if (isMastered(review)) meta.push({ icon: "check", text: "Review ladder mastered" });

  const handleCheckboxChange = (checked: boolean) => {
    if (!checked) {
      // Un-checking is always free -- no gate, no panel.
      dispatch({ type: "TOGGLE_DONE", id: problem.id, done: false });
      return;
    }
    if (canCompleteFreely(progress, v2Store.settings)) {
      dispatch({ type: "TOGGLE_DONE", id: problem.id, done: true });
      // Recorded as a clean solve; this is the chance to say otherwise.
      setAsking("solve");
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
        // The 2px edge is always reserved, coloured only when the row is in
        // the goal, so nothing shifts as goals change.
        "rounded-lg py-2 pr-2.5 pl-2 -mx-1 scroll-mt-32 transition-colors border-l-2",
        inGoal ? "border-accent" : "border-transparent",
        "hover:bg-row-hover",
        (detailsOpen || completionPanelOpen || asking) && "bg-row-hover",
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
        {link ? (
          <a
            className={cx(
              "text-body min-w-0 decoration-accent/40 underline-offset-2 hover:underline hover:text-accent",
              state.done ? "line-through text-faint hover:text-faint" : "text-fg"
            )}
            href={link}
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
        {/* Multi-site practice links: only when there is more than the title's own. */}
        {links.length > 1 && (
          <span className="flex items-center gap-1.5 text-micro">
            {links.map(([label, url]) => (
              <a key={url} href={url} target="_blank" rel="noopener" className="text-faint hover:text-accent">
                {label}
              </a>
            ))}
          </span>
        )}
        {problem.premium && (
          <span className="pill leading-none px-1.5 text-micro bg-star-soft text-star" title="LeetCode Premium">
            Premium
          </span>
        )}
        {problem.sources?.map((src) => (
          <span
            key={src}
            className="pill leading-none px-1.5 text-micro font-medium bg-sunken text-faint"
            title={SOURCES[src as keyof typeof SOURCES] ?? src}
          >
            {src}
          </span>
        ))}
        {!state.done &&
          lockedBy.map((name) => (
            <span
              key={name}
              className="pill leading-none px-1.5 text-micro bg-medium-soft text-medium"
              title={`Builds on ${name}, which isn't finished yet`}
            >
              <Icon name="lock" className="size-2.5" />
              {name}
            </span>
          ))}
        {reviewDue ? (
          <button
            type="button"
            className="pill leading-none px-1.5 text-micro bg-accent-soft text-accent cursor-pointer"
            title="Re-solve it without looking at your old code, then say how it went"
            aria-expanded={asking === "review"}
            onClick={() => setAsking((a) => (a === "review" ? null : "review"))}
          >
            <Icon name="bell" className="size-2.5" />
            Review due
          </button>
        ) : (
          review && (
            <span className="text-micro text-faint" title={review.dueAt ? `Next review ${review.dueAt}` : "Mastered"}>
              {review.dueAt ? `review in ${daysUntil(review.dueAt, today)}d` : "mastered"}
            </span>
          )
        )}
      </div>

      {/* Actions stay put instead of wrapping: the star and the expander are
          in the same place on every one of 467 rows. */}
      <div className="flex items-center gap-0.5 justify-self-end">
        {problem.video && (
          <a
            className="icon-btn size-7 text-faint hover:text-accent max-sm:hidden"
            href={problem.video}
            target="_blank"
            rel="noopener"
            title="Video solution"
            aria-label={`Video solution for ${problem.question}`}
          >
            <Icon name="play" className="size-3.5" />
          </a>
        )}
        {problem.article && (
          <a
            className="icon-btn size-7 text-faint hover:text-accent max-sm:hidden"
            href={problem.article}
            target="_blank"
            rel="noopener"
            title="Article"
            aria-label={`Article for ${problem.question}`}
          >
            <Icon name="book" className="size-3.5" />
          </a>
        )}
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
      {(completionPanelOpen || detailsOpen || asking) && (
        <div className="col-start-2 col-span-2 min-w-0">
          {asking && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <ReviewOutcomeButtons
                label={asking === "solve" ? "How did the solve go?" : "How did the review go?"}
                value={asking === "solve" ? progress.review?.log.at(-1)?.outcome : undefined}
                onPick={(outcome) => {
                  dispatchV2({ type: asking === "solve" ? "RECORD_SOLVE" : "RECORD_REVIEW", id: problem.id, outcome, at: today });
                  setAsking(null);
                }}
              />
              <button type="button" className="icon-btn size-6" aria-label="Dismiss" onClick={() => setAsking(null)}>
                <Icon name="x" className="size-3.5" />
              </button>
            </div>
          )}
          {completionPanelOpen && (
            <CompletionPanel
              problem={problem}
              topicName={topicName}
              patternName={patternName}
              onCancel={() => setCompletionPanelOpen(false)}
              onCompleted={() => setCompletionPanelOpen(false)}
            />
          )}
          {/* Kept mounted-but-hidden rather than unmounted: the editors below
              are uncontrolled (defaultValue), so unmounting would discard an
              unblurred draft. */}
          <div className={cx("mt-2 border-l-2 border-accent-line pl-3.5", detailsOpen ? "block" : "hidden")}>
            {(meta.length > 0 || problem.video || problem.article) && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {meta.map((m) => (
                  <span key={m.text} className="chip">
                    <Icon name={m.icon} className="size-3" />
                    {m.text}
                  </span>
                ))}
                {/* On phones these are the only way to the links: the row's icons are hidden there. */}
                {problem.video && (
                  <a className="chip hover:text-accent" href={problem.video} target="_blank" rel="noopener">
                    <Icon name="play" className="size-3" />
                    Video
                  </a>
                )}
                {problem.article && (
                  <a className="chip hover:text-accent" href={problem.article} target="_blank" rel="noopener">
                    <Icon name="book" className="size-3" />
                    Article
                  </a>
                )}
              </div>
            )}
            {state.done && !reviewDue && (
              <div className="mb-3">
                <ReviewOutcomeButtons
                  label={review ? "Reviewed it early?" : "Start spaced reviews:"}
                  onPick={(outcome) => dispatchV2({ type: "RECORD_REVIEW", id: problem.id, outcome, at: today })}
                />
              </div>
            )}
            <SolutionEditor problemId={problem.id} />
            <NotesEditor problem={problem} topicName={topicName} patternName={patternName} />
            <MistakeList problemId={problem.id} />
          </div>
        </div>
      )}
    </div>
  );
}
