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

export function Dashboard({ allProblems, onContinue }: { allProblems: Problem[]; onContinue: (id: string) => void }) {
  const { store } = useStore();
  const [yearOffset, setYearOffset] = useState(0);
  const cardRef = useRef<HTMLElement>(null);

  const { doneByDate, revisedByDate } = buildHeatmapStats(store);
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
    <section ref={cardRef} className="relative border border-border rounded-lg py-3 px-3.5 mb-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
        <h2 className="text-[0.95rem] font-semibold m-0">Activity</h2>
        {next && (
          <button
            className="mr-auto text-[0.8rem] px-2.5 py-[5px] border border-border rounded-md bg-transparent text-fg cursor-pointer hover:bg-row-hover"
            onClick={() => onContinue(next.id)}
          >
            Continue →
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <button
            className="text-[0.95rem] leading-none py-1 px-2.5 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Previous year"
            aria-label="Previous year"
            disabled={yearOffset >= maxOffset}
            onClick={() => setYearOffset((o) => Math.min(o + 1, maxOffset))}
          >
            ‹
          </button>
          <span className="text-[0.85rem] font-semibold min-w-[60px] text-center">{range.label}</span>
          <button
            className="text-[0.95rem] leading-none py-1 px-2.5 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Next year"
            aria-label="Next year"
            disabled={yearOffset === 0}
            onClick={() => setYearOffset((o) => Math.max(o - 1, 0))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2 mb-3">
        <StatTile value={streak} label="day streak" />
        <StatTile value={todayCount} label="solved today" />
        <StatTile value={totalDone} label="in this range" />
      </div>

      <Heatmap months={months} cardRef={cardRef} />

      <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
        <span className="text-[0.8rem] text-muted">
          {`${totalDone} solved · ${totalRevised} revised on ${activeDays} active day${activeDays === 1 ? "" : "s"} in this range`}
        </span>
        <div className="flex items-center gap-1 text-[0.7rem] text-muted">
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

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-px border border-border rounded-lg py-2 px-2.5">
      <span className="text-[1.15rem] font-semibold tabular-nums">{value}</span>
      <span className="text-[0.7rem] text-muted">{label}</span>
    </div>
  );
}
