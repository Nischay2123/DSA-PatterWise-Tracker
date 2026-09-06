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
import { Icon } from "./Icon";
import { DIFFICULTY_PILL } from "./QuestionRow";
import { StatTile } from "./StatTile";
import { cx } from "../cx";

export function Dashboard({
  allProblems,
  goalProblems,
  onContinue,
}: {
  allProblems: Problem[];
  /** The goal scope. Equal to allProblems under the default goal. */
  goalProblems: Problem[];
  onContinue: (id: string) => void;
}) {
  const { store, v2Store } = useStore();
  const [yearOffset, setYearOffset] = useState(0);
  // The heatmap tooltip is absolutely positioned and measures against this
  // element, so this <section> MUST stay `relative` and nothing between it
  // and the tooltip may become a positioning context.
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
  // Points at the next unsolved problem IN THE GOAL, so "Continue" sends you
  // somewhere that counts toward what you actually set out to do.
  const next = findNextUnsolved(goalProblems, store) ?? findNextUnsolved(allProblems, store);
  const maxOffset = Math.max(earliestYearOffset(store), 1);

  return (
    <section ref={cardRef} className="relative">
      <div className="grid gap-3 mb-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* "Continue →" used to be a small button floating in a header. The
            next problem is the single most actionable thing on the page, so
            it gets named, not just linked to. */}
        <div className="card p-4 flex items-center gap-3.5 bg-linear-to-br from-accent-soft to-surface">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg shadow-panel">
            <Icon name="target" className="size-5" />
          </span>
          {next ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="field-label mb-0.5">Up next</div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cx("pill px-1.5 shrink-0 font-bold", DIFFICULTY_PILL[next.difficulty])}>
                    {next.difficulty[0]}
                  </span>
                  <span className="text-body font-semibold truncate">{next.question}</span>
                </div>
              </div>
              <button className="btn btn-primary shrink-0" onClick={() => onContinue(next.id)}>
                <span className="max-sm:hidden">Continue</span>
                <Icon name="arrowRight" className="size-4" />
              </button>
            </>
          ) : (
            <div className="min-w-0">
              <div className="field-label mb-0.5">Up next</div>
              <div className="text-body font-semibold">Everything is solved. 🎉</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <StatTile value={streak} label="day streak" icon="flame" tone="hard" />
          <StatTile value={todayCount} label="solved today" icon="calendar" tone="accent" />
          <StatTile value={totalDone} label="in this range" icon="check" tone="accent" />
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-display text-head font-bold m-0 flex items-center gap-2">
            <Icon name="calendar" className="size-4 text-accent" />
            Activity
          </h2>
          <div className="flex items-center gap-1 rounded-full border border-border bg-bg p-0.5">
            <button
              className="icon-btn size-6.5"
              title="Previous year"
              aria-label="Previous year"
              disabled={yearOffset >= maxOffset}
              onClick={() => setYearOffset((o) => Math.min(o + 1, maxOffset))}
            >
              <Icon name="chevronLeft" className="size-3.5" />
            </button>
            <span className="text-ui font-semibold min-w-14 text-center tabular-nums">{range.label}</span>
            <button
              className="icon-btn size-6.5"
              title="Next year"
              aria-label="Next year"
              disabled={yearOffset === 0}
              onClick={() => setYearOffset((o) => Math.max(o - 1, 0))}
            >
              <Icon name="chevronRight" className="size-3.5" />
            </button>
          </div>
        </div>

        <Heatmap months={months} cardRef={cardRef} />

        <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-border">
          <span className="text-caption text-muted">
            <strong className="text-fg font-semibold tabular-nums">{totalDone}</strong> solved ·{" "}
            <strong className="text-fg font-semibold tabular-nums">{totalRevised}</strong> revised in sessions ·{" "}
            {activeDays} active day{activeDays === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-1 text-micro text-faint">
            <span>Less</span>
            {["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"].map((c) => (
              <div key={c} className={cx("size-2.5 rounded-[3px]", c)} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      <Analytics allProblems={allProblems} />
    </section>
  );
}
