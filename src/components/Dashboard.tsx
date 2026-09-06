import { useRef, useState } from "react";
import { useStore } from "../context";
import {
  buildHeatmapMonths,
  buildHeatmapStats,
  computeStreak,
  earliestYearOffset,
  findNextUnsolved,
  getHeatmapRange,
  todayISO,
} from "../store";
import type { Problem } from "../types";
import { Analytics } from "./Analytics";
import { Heatmap } from "./Heatmap";
import { StatTile } from "./StatTile";

export function Dashboard({ allProblems, onContinue }: { allProblems: Problem[]; onContinue: (id: string) => void }) {
  const { store, v2Store } = useStore();
  const [yearOffset, setYearOffset] = useState(0);
  const cardRef = useRef<HTMLElement>(null);

  const { doneByDate, revisedByDate } = buildHeatmapStats(store, v2Store);
  const range = getHeatmapRange(yearOffset);
  const months = buildHeatmapMonths(doneByDate, revisedByDate, range);
  const allDays = months.flatMap((m) => m.days);

  const totalDone = allDays.reduce((s, d) => s + d.done, 0);
  const totalRevised = allDays.reduce((s, d) => s + d.revised, 0);
  const activeDays = allDays.filter((d) => d.done > 0).length;
  const streak = computeStreak(doneByDate);
  const todayCount = doneByDate.get(todayISO()) || 0;
  const next = findNextUnsolved(allProblems, store);
  const maxOffset = Math.max(earliestYearOffset(store), 1);

  return (
    <section ref={cardRef} className="card relative p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
        <h2 className="text-head font-semibold m-0">Activity</h2>
        {next && (
          <button
            className="btn btn-sm mr-auto"
            onClick={() => onContinue(next.id)}
          >
            Continue →
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <button
            className="btn btn-sm px-2"
            title="Previous year"
            aria-label="Previous year"
            disabled={yearOffset >= maxOffset}
            onClick={() => setYearOffset((o) => Math.min(o + 1, maxOffset))}
          >
            ‹
          </button>
          <span className="text-ui font-semibold min-w-16 text-center tabular-nums">{range.label}</span>
          <button
            className="btn btn-sm px-2"
            title="Next year"
            aria-label="Next year"
            disabled={yearOffset === 0}
            onClick={() => setYearOffset((o) => Math.max(o - 1, 0))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 max-w-md">
        <StatTile value={streak} label="day streak" />
        <StatTile value={todayCount} label="solved today" />
        <StatTile value={totalDone} label="in this range" />
      </div>

      <Heatmap months={months} cardRef={cardRef} />

      <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
        <span className="text-caption text-muted">
          {`${totalDone} solved · ${totalRevised} revised in sessions on ${activeDays} active day${activeDays === 1 ? "" : "s"} in this range`}
        </span>
        <div className="flex items-center gap-1 text-micro text-muted">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <div key={l} className={`w-2.5 h-2.5 rounded-sm ${["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"][l]}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <Analytics allProblems={allProblems} />
    </section>
  );
}

