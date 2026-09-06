import { useEffect, useRef } from "react";
import { MOBILE_QUERY } from "../breakpoints";
import { useFilters, useStore } from "../context";
import { getCuratedList, isDefaultGoal, resolveGoal } from "../revision/goal";
import { cx } from "../cx";
import { Icon, type IconName } from "./Icon";

const DIFFICULTIES = ["All", "Easy", "Medium", "Hard"] as const;

const DIFFICULTY_ACTIVE: Record<string, string> = {
  All: "bg-accent text-accent-fg",
  Easy: "bg-easy text-bg",
  Medium: "bg-medium text-bg",
  Hard: "bg-hard text-bg",
};

// A native <select> with its own chevron and no UA arrow, so it matches the
// segmented control beside it instead of looking like a stray form control.
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        className="field appearance-none w-auto py-1.5 pr-7 text-ui md:text-ui font-medium cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-faint"
      />
    </div>
  );
}

// Replaces a bare checkbox + text label. Same state, but it reads as part of
// the toolbar and gives a coarse pointer something worth hitting.
function Toggle({
  on,
  onToggle,
  icon,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cx(
        "chip cursor-pointer transition-colors py-1.5",
        on ? "border-accent bg-accent-soft text-accent" : "hover:border-border-strong hover:text-fg"
      )}
    >
      <Icon name={icon} className="size-3.5" filled={on && icon === "star"} />
      {children}
    </button>
  );
}

export function Filters() {
  const { filters, setFilters } = useFilters();
  const { v2Store } = useStore();
  const goal = resolveGoal(v2Store.settings);
  // Hidden under the default goal: it would match every row, so it would be
  // a control that does nothing. Leaving it switched on is harmless for the
  // same reason, so switching back to the full syllabus can never strand
  // anyone behind an invisible filter.
  const goalActive = !isDefaultGoal(goal);
  const goalName = getCuratedList(goal.listId)?.label ?? "goal";
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // <details> hides its content when closed regardless of display, so the
  // disclosure has to be forced open on wide screens where its <summary> is
  // display:none and there is therefore nothing left to click.
  //
  // MOBILE_QUERY must stay in lockstep with --breakpoint-md in index.css:
  // if CSS hides the summary at a width where this still reports mobile,
  // the filter controls become unreachable in that band.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => {
      if (detailsRef.current) detailsRef.current.open = !mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const activeCount =
    (filters.difficulty !== "All" ? 1 : 0) +
    (filters.importance !== "All" ? 1 : 0) +
    (filters.freq !== "All" ? 1 : 0) +
    (filters.hideCompleted ? 1 : 0) +
    (filters.reviseOnly ? 1 : 0) +
    (goalActive && filters.goalOnly ? 1 : 0);

  return (
    <div className="flex items-center gap-2 py-2.5 flex-wrap">
      {/* Search leads the toolbar and owns the width — it is the control
          people actually reach for on 467 rows. */}
      <div className="relative flex-[1_1_16rem] min-w-0 max-w-md">
        <Icon
          name="search"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-faint"
        />
        <input
          type="search"
          placeholder="Search problems, topics, patterns…"
          aria-label="Search problems"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="field pl-8.5 rounded-full"
        />
      </div>

      <details ref={detailsRef} className="group/filters flex-1 min-w-0 max-md:flex-[1_1_100%]">
        <summary
          className="disclosure hidden max-md:inline-flex max-md:items-center max-md:gap-1.5
            max-md:w-max max-md:btn max-md:btn-sm max-md:py-1.5"
        >
          <Icon name="filter" className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-accent text-accent-fg text-[10px] font-bold">
              {activeCount}
            </span>
          )}
          <Icon name="chevronDown" className="size-3.5 transition-transform group-open/filters:rotate-180" />
        </summary>

        <div className="flex flex-wrap items-center gap-2 max-md:pt-2.5">
          {/* One segmented control instead of four separate buttons: the
              difficulties are mutually exclusive, so they should look it. */}
          <div
            className="inline-flex gap-0.5 rounded-full border border-border bg-bg p-0.5"
            role="group"
            aria-label="Filter by difficulty"
          >
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={filters.difficulty === d}
                className={cx(
                  "px-2.5 h-6.5 rounded-full border-0 cursor-pointer text-micro font-semibold transition-colors",
                  filters.difficulty === d
                    ? DIFFICULTY_ACTIVE[d]
                    : "bg-transparent text-muted hover:text-fg hover:bg-row-hover"
                )}
                onClick={() => setFilters((f) => ({ ...f, difficulty: d }))}
              >
                {d}
              </button>
            ))}
          </div>

          <Select
            label="Filter by importance"
            value={filters.importance}
            onChange={(v) => setFilters((f) => ({ ...f, importance: v }))}
            options={[
              { value: "All", label: "Importance: All" },
              { value: "High", label: "Importance: High" },
              { value: "Medium", label: "Importance: Medium" },
              { value: "Low", label: "Importance: Low" },
            ]}
          />
          <Select
            label="Filter by interview frequency"
            value={filters.freq}
            onChange={(v) => setFilters((f) => ({ ...f, freq: v }))}
            options={[
              { value: "All", label: "Interview freq: All" },
              { value: "Very High", label: "Interview freq: Very High" },
              { value: "High", label: "Interview freq: High" },
              { value: "Medium", label: "Interview freq: Medium" },
              { value: "Low", label: "Interview freq: Low" },
            ]}
          />

          {goalActive && (
            <Toggle
              on={!!filters.goalOnly}
              onToggle={() => setFilters((f) => ({ ...f, goalOnly: !f.goalOnly }))}
              icon="target"
            >
              In my {goalName}
            </Toggle>
          )}
          <Toggle
            on={filters.hideCompleted}
            onToggle={() => setFilters((f) => ({ ...f, hideCompleted: !f.hideCompleted }))}
            icon="check"
          >
            Hide completed
          </Toggle>
          <Toggle
            on={filters.reviseOnly}
            onToggle={() => setFilters((f) => ({ ...f, reviseOnly: !f.reviseOnly }))}
            icon="star"
          >
            Starred only
          </Toggle>
        </div>
      </details>
    </div>
  );
}
