import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  breakdownBy,
  buildHeatmapStats,
  countDoneInStore,
  findNextUnsolved,
  formatDayLabel,
  migrateIdsIfNeeded,
} from "./store";
import { useFilters, useStore } from "./context";
import { extractJson } from "./llm/schema";
import { emptyAppStoreV2 } from "./persistence/migrate";
import type { Problem, ProgressStore } from "./types";

function state(patch: Partial<ProgressStore["problems"][string]> = {}) {
  return { done: false, revise: false, notes: "", completedAt: null, revisedAt: null, ...patch };
}

function problem(id: string, patch: Partial<Problem> = {}): Problem {
  return {
    id, subpattern: "", question: id, platform: "", link: null,
    difficulty: "Easy", originalStep: "", estMinutes: "", importance: "High", interviewFreq: "High",
    ...patch,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("analytics helpers", () => {
  const store: ProgressStore = {
    version: 1,
    idsMigrated: true,
    problems: { a: state({ done: true }), b: state(), c: state({ done: true }) },
  };

  it("countDoneInStore counts done entries and tolerates null ones", () => {
    expect(countDoneInStore(store)).toBe(2);
    expect(countDoneInStore({ version: 1, problems: { x: null as never } })).toBe(0);
  });

  it("breakdownBy groups by key in the requested order, dropping empty buckets", () => {
    const problems = [problem("a", { difficulty: "Easy" }), problem("b", { difficulty: "Hard" }), problem("c", { difficulty: "Easy" })];
    const rows = breakdownBy(problems, (p) => p.difficulty, ["Easy", "Medium", "Hard"], store);
    expect(rows).toEqual([
      { label: "Easy", done: 2, total: 2 },
      { label: "Hard", done: 0, total: 1 },
    ]);
  });

  it("breakdownBy ignores a problem whose key isn't in the requested order", () => {
    const rows = breakdownBy([problem("a", { importance: "Unlisted" })], (p) => p.importance, ["High"], store);
    expect(rows).toEqual([]);
  });

  it("findNextUnsolved returns the first unsolved, or null when everything is done", () => {
    expect(findNextUnsolved([problem("a"), problem("b")], store)?.id).toBe("b");
    expect(findNextUnsolved([problem("a"), problem("c")], store)).toBeNull();
    expect(findNextUnsolved([], store)).toBeNull();
  });

  it("formatDayLabel renders a human date", () => {
    expect(formatDayLabel(new Date(2026, 0, 5))).toBe("Jan 5, 2026");
    expect(formatDayLabel(new Date(2026, 11, 31))).toBe("Dec 31, 2026");
  });

  it("buildHeatmapStats counts completions per day and reads revisions from v2", () => {
    const withDates: ProgressStore = {
      version: 1,
      problems: { a: state({ completedAt: "2026-01-01" }), b: state({ completedAt: "2026-01-01" }), c: state() },
    };
    const { doneByDate, revisedByDate } = buildHeatmapStats(withDates, emptyAppStoreV2());
    expect(doneByDate.get("2026-01-01")).toBe(2);
    expect(revisedByDate.size).toBe(0);
  });
});

describe("id migration reporting", () => {
  it("warns about unmapped ids rather than dropping them silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, migrated } = migrateIdsIfNeeded({
      version: 1,
      problems: { "totally-unknown-id": state({ done: true }) },
    });
    expect(migrated).toBe(true);
    expect(store.problems["totally-unknown-id"].done).toBe(true); // preserved
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("context guards", () => {
  it("useStore refuses to run outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useStore())).toThrow(/within StoreContext/);
  });

  it("useFilters refuses to run outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useFilters())).toThrow(/within FiltersContext/);
  });
});

describe("extractJson on malformed-but-braced text", () => {
  it("returns null when the braces are there but the JSON is invalid", () => {
    // Both braces present, so this reaches JSON.parse and fails there --
    // a different path from the truncated case, which bails earlier.
    expect(extractJson('{"a": }')).toBeNull();
    expect(extractJson("{oops}")).toBeNull();
  });

  it("returns null when the closing brace precedes the opening one", () => {
    expect(extractJson("} {")).toBeNull();
  });
});
