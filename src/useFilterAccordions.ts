import { useEffect, useRef } from "react";
import { areFiltersActive } from "./store";
import type { FilterState } from "./types";

// Mirrors applyFilters() in ea95806:app.js. <details> open state is uncontrolled
// DOM state, so this is deliberately imperative and runs after children render.
export function useFilterAccordions(filters: FilterState) {
  const lastSig = useRef("");
  const snapshot = useRef<Map<HTMLDetailsElement, boolean> | null>(null);

  useEffect(() => {
    const sig = [
      filters.search.trim().toLowerCase(),
      filters.difficulty,
      filters.importance,
      filters.freq,
      filters.hideCompleted,
      filters.reviseOnly,
    ].join(" ");
    const changed = sig !== lastSig.current;
    lastSig.current = sig;
    const active = areFiltersActive(filters);
    const all = Array.from(document.querySelectorAll<HTMLDetailsElement>("details[data-accordion]"));

    if (active && changed && !snapshot.current) {
      snapshot.current = new Map(all.map((d) => [d, d.open]));
    }
    if (active && changed) {
      for (const d of all) {
        const hasVisibleRow = Array.from(d.querySelectorAll(".problem-row")).some(
          (r) => !r.classList.contains("hidden")
        );
        if (hasVisibleRow) d.open = true;
      }
    }
    if (!active && snapshot.current) {
      snapshot.current.forEach((wasOpen, d) => {
        d.open = wasOpen;
      });
      snapshot.current = null;
    }
  }, [filters]);
}
