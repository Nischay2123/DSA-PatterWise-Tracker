import { useEffect, useRef } from "react";
import { useFilters } from "../context";
import { cx } from "../cx";

const DIFFICULTIES = ["All", "Easy", "Medium", "Hard"] as const;

export function Filters() {
  const { filters, setFilters } = useFilters();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // <details> hides its content when closed regardless of display, so the
  // disclosure has to be forced open on wide screens where it renders inline.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const sync = () => {
      if (detailsRef.current) detailsRef.current.open = !mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
      <input
        type="search"
        placeholder="Search problems..."
        aria-label="Search problems"
        value={filters.search}
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        className="flex-[0_1_260px] min-w-[160px] px-2.5 py-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base"
      />
      <details ref={detailsRef} className="group/filters flex-1 min-w-0 max-[700px]:flex-[1_1_100%]">
        <summary
          className="hidden cursor-pointer list-none [&::-webkit-details-marker]:hidden
            max-[700px]:inline-block max-[700px]:w-max max-[700px]:text-[0.8rem] max-[700px]:px-2.5 max-[700px]:py-[5px]
            max-[700px]:border max-[700px]:border-border max-[700px]:rounded-md max-[700px]:text-fg
            before:content-['▸_'] group-open/filters:before:content-['▾_']"
        >
          Filters
        </summary>
        <div className="flex flex-wrap items-center gap-3 max-[700px]:pt-2.5">
          <div className="flex gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={cx(
                  "text-[0.8rem] px-2.5 py-[5px] border border-border rounded-md cursor-pointer",
                  filters.difficulty === d ? "bg-fg text-bg" : "bg-transparent text-fg"
                )}
                onClick={() => setFilters((f) => ({ ...f, difficulty: d }))}
              >
                {d}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter by importance"
            className="text-[0.8rem] py-[5px] px-2 border border-border rounded-md bg-bg text-fg max-[700px]:text-base"
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
            className="text-[0.8rem] py-[5px] px-2 border border-border rounded-md bg-bg text-fg max-[700px]:text-base"
            value={filters.freq}
            onChange={(e) => setFilters((f) => ({ ...f, freq: e.target.value }))}
          >
            <option value="All">Interview Freq: All</option>
            <option value="Very High">Interview Freq: Very High</option>
            <option value="High">Interview Freq: High</option>
            <option value="Medium">Interview Freq: Medium</option>
            <option value="Low">Interview Freq: Low</option>
          </select>
          <label className="text-[0.85rem] text-muted flex items-center gap-1">
            <input
              type="checkbox"
              checked={filters.hideCompleted}
              onChange={(e) => setFilters((f) => ({ ...f, hideCompleted: e.target.checked }))}
            />
            Hide completed
          </label>
          <label className="text-[0.85rem] text-muted flex items-center gap-1">
            <input
              type="checkbox"
              checked={filters.reviseOnly}
              onChange={(e) => setFilters((f) => ({ ...f, reviseOnly: e.target.checked }))}
            />
            ★ Revision only
          </label>
        </div>
      </details>
    </div>
  );
}
