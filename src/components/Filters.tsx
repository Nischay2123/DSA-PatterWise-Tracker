import { useEffect, useRef } from "react";
import { MOBILE_QUERY } from "../breakpoints";
import { useFilters } from "../context";
import { cx } from "../cx";

const DIFFICULTIES = ["All", "Easy", "Medium", "Hard"] as const;

const SELECT_CLASS = "field w-auto py-1.5 text-ui md:text-ui";

export function Filters() {
  const { filters, setFilters } = useFilters();
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

  return (
    <div className="flex items-center gap-2 pb-2.5 flex-wrap">
      <input
        type="search"
        placeholder="Search problems…"
        aria-label="Search problems"
        value={filters.search}
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        className="field flex-[0_1_18rem] min-w-[10rem] w-auto"
      />
      <details ref={detailsRef} className="group/filters flex-1 min-w-0 max-md:flex-[1_1_100%]">
        <summary
          className="disclosure hidden max-md:inline-flex max-md:items-center max-md:gap-1.5 max-md:w-max
            max-md:btn max-md:btn-sm
            before:content-['▸'] group-open/filters:before:content-['▾']"
        >
          Filters
        </summary>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 max-md:pt-2.5">
          <div className="flex gap-1" role="group" aria-label="Filter by difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={filters.difficulty === d}
                className={cx("btn btn-sm", filters.difficulty === d && "btn-primary")}
                onClick={() => setFilters((f) => ({ ...f, difficulty: d }))}
              >
                {d}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter by importance"
            className={SELECT_CLASS}
            value={filters.importance}
            onChange={(e) => setFilters((f) => ({ ...f, importance: e.target.value }))}
          >
            <option value="All">Importance: All</option>
            <option value="High">Importance: High</option>
            <option value="Medium">Importance: Medium</option>
            <option value="Low">Importance: Low</option>
          </select>
          <select
            aria-label="Filter by interview frequency"
            className={SELECT_CLASS}
            value={filters.freq}
            onChange={(e) => setFilters((f) => ({ ...f, freq: e.target.value }))}
          >
            <option value="All">Interview Freq: All</option>
            <option value="Very High">Interview Freq: Very High</option>
            <option value="High">Interview Freq: High</option>
            <option value="Medium">Interview Freq: Medium</option>
            <option value="Low">Interview Freq: Low</option>
          </select>
          <label className="text-ui text-muted flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hideCompleted}
              onChange={(e) => setFilters((f) => ({ ...f, hideCompleted: e.target.checked }))}
            />
            Hide completed
          </label>
          <label className="text-ui text-muted flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.reviseOnly}
              onChange={(e) => setFilters((f) => ({ ...f, reviseOnly: e.target.checked }))}
            />
            <span className="text-star">★</span> Revision only
          </label>
        </div>
      </details>
    </div>
  );
}
