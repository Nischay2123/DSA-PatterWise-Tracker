import { useEffect, useRef, type RefObject } from "react";
import { formatDayLabel, heatmapLevel } from "../store";
import type { HeatmapMonth } from "../types";

interface Cell {
  key: string;
  level?: 0 | 1 | 2 | 3 | 4;
  tip?: string;
}

function buildWeeks(month: HeatmapMonth): Cell[][] {
  const cells: Cell[] = [];
  for (let i = 0; i < month.pad; i++) cells.push({ key: `pad-${i}` });
  month.days.forEach((day) => {
    const level = heatmapLevel(day.done);
    const revisedPart = day.revised ? ` · ${day.revised} revised` : "";
    const tip = `${day.done} solved${revisedPart} on ${formatDayLabel(day.date)}`;
    cells.push({ key: day.date.toISOString(), level, tip });
  });
  while (cells.length % 7) cells.push({ key: `pad-end-${cells.length}` });
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const HEATMAP_DAY_CLASS =
  "heatmap-day w-2.5 h-2.5 rounded-sm bg-heat-0 focus-visible:outline-offset-1 " +
  "[@media(pointer:coarse)]:w-[13px] [@media(pointer:coarse)]:h-[13px] " +
  "data-[level='1']:bg-heat-1 data-[level='2']:bg-heat-2 data-[level='3']:bg-heat-3 data-[level='4']:bg-heat-4";

export function Heatmap({ months, cardRef }: { months: HeatmapMonth[]; cardRef: RefObject<HTMLElement | null> }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const tip = tipRef.current;
    const card = cardRef.current;
    if (!grid || !tip || !card) return;

    function showTip(cell: HTMLElement) {
      if (!tip || !card) return;
      tip.textContent = cell.dataset.tip || "";
      tip.hidden = false;
      const cellBox = cell.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const left = cellBox.left - cardBox.left + cellBox.width / 2 - tip.offsetWidth / 2;
      const maxLeft = cardBox.width - tip.offsetWidth - 4;
      tip.style.left = `${Math.max(4, Math.min(left, maxLeft))}px`;
      tip.style.top = `${cellBox.top - cardBox.top - tip.offsetHeight - 6}px`;
    }
    function hideTip() {
      if (tip) tip.hidden = true;
    }
    function findCell(target: EventTarget | null): HTMLElement | null {
      return target instanceof HTMLElement ? target.closest<HTMLElement>(".heatmap-day[data-tip]") : null;
    }
    function onPointerOver(e: PointerEvent) {
      const cell = findCell(e.target);
      if (cell) showTip(cell);
    }
    function onFocusIn(e: FocusEvent) {
      const cell = findCell(e.target);
      if (cell) showTip(cell);
    }
    // Touch: no hover exists, so a tap has to both show and pin the tip.
    function onGridClick(e: MouseEvent) {
      const cell = findCell(e.target);
      if (cell) showTip(cell);
    }
    function onDocClick(e: MouseEvent) {
      if (!(e.target instanceof HTMLElement) || !e.target.closest("#heatmapGrid")) hideTip();
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") hideTip();
    }

    grid.addEventListener("pointerover", onPointerOver);
    grid.addEventListener("pointerleave", hideTip);
    grid.addEventListener("focusin", onFocusIn);
    grid.addEventListener("focusout", hideTip);
    grid.addEventListener("click", onGridClick);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeydown);
    return () => {
      grid.removeEventListener("pointerover", onPointerOver);
      grid.removeEventListener("pointerleave", hideTip);
      grid.removeEventListener("focusin", onFocusIn);
      grid.removeEventListener("focusout", hideTip);
      grid.removeEventListener("click", onGridClick);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeydown);
    };
  }, [cardRef, months]);

  return (
    <div className="overflow-x-auto pb-1">
      <div id="heatmapGrid" ref={gridRef} className="flex gap-1.5 w-max">
        {months.map((month, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex gap-0.5">
              {buildWeeks(month).map((week, wi) => (
                <div
                  key={wi}
                  className="grid gap-0.5 grid-rows-[repeat(7,10px)] [@media(pointer:coarse)]:grid-rows-[repeat(7,13px)]"
                >
                  {week.map((cell) =>
                    cell.tip !== undefined ? (
                      <div
                        key={cell.key}
                        className={HEATMAP_DAY_CLASS}
                        data-level={cell.level}
                        data-tip={cell.tip}
                        tabIndex={0}
                        role="img"
                        aria-label={cell.tip}
                      />
                    ) : (
                      <div key={cell.key} className="w-2.5 h-2.5 [@media(pointer:coarse)]:w-[13px] [@media(pointer:coarse)]:h-[13px]" />
                    )
                  )}
                </div>
              ))}
            </div>
            <div className="text-[0.7rem] text-muted text-center whitespace-nowrap">{month.label}</div>
          </div>
        ))}
      </div>
      <div
        ref={tipRef}
        role="status"
        aria-live="polite"
        hidden
        className="absolute z-[5] pointer-events-none py-[5px] px-[9px] rounded-md bg-tip-bg text-tip-fg text-[0.72rem] whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
      />
    </div>
  );
}
