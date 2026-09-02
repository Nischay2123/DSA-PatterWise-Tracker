import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cx } from "./cx";
import { useHash } from "./useHash";
import { useFilterAccordions } from "./useFilterAccordions";
import { downloadBackupFile, backupLegacy, LEGACY_BACKUP_KEY, LEGACY_BACKUP_UNDO_KEY } from "./persistence/backup";
import type { FilterState } from "./types";

vi.mock("idb-keyval", () => ({ set: vi.fn(async () => {}) }));
const idb = await import("idb-keyval");

function filters(patch: Partial<FilterState> = {}): FilterState {
  return { search: "", difficulty: "All", importance: "All", freq: "All", hideCompleted: false, reviseOnly: false, ...patch };
}

afterEach(() => {
  document.body.innerHTML = "";
  window.location.hash = "";
  vi.clearAllMocks();
});

describe("cx", () => {
  it("joins truthy class names and drops the rest", () => {
    expect(cx("a", "b")).toBe("a b");
    expect(cx("a", false, undefined, null, "", "b")).toBe("a b");
    expect(cx()).toBe("");
  });
});

describe("useHash", () => {
  it("defaults to the tracker route when there is no hash", () => {
    const { result } = renderHook(() => useHash());
    expect(result.current[0]).toBe("#/tracker");
  });

  it("reads the current hash on mount", () => {
    window.location.hash = "#/revision";
    const { result } = renderHook(() => useHash());
    expect(result.current[0]).toBe("#/revision");
  });

  it("navigates, and reflects the change", () => {
    const { result } = renderHook(() => useHash());
    act(() => result.current[1]("#/revision/arrays"));
    act(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
    expect(result.current[0]).toBe("#/revision/arrays");
  });

  it("tracks back/forward navigation via the hashchange event", () => {
    const { result } = renderHook(() => useHash());
    act(() => {
      window.location.hash = "#/revision";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current[0]).toBe("#/revision");
  });

  it("stops listening once unmounted", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    renderHook(() => useHash()).unmount();
    expect(remove).toHaveBeenCalledWith("hashchange", expect.any(Function));
  });
});

describe("useFilterAccordions", () => {
  // Mirrors the real DOM shape: a [data-accordion] wrapper per group, with
  // .problem-row children that the filter marks hidden.
  function build(rows: { hidden: boolean }[][]) {
    document.body.innerHTML = rows
      .map(
        (group) =>
          `<details data-accordion>${group
            .map((r) => `<div class="problem-row${r.hidden ? " hidden" : ""}"></div>`)
            .join("")}</details>`
      )
      .join("");
    return Array.from(document.querySelectorAll<HTMLDetailsElement>("details"));
  }

  it("does nothing while no filter is active", () => {
    const [a] = build([[{ hidden: false }]]);
    renderHook(({ f }) => useFilterAccordions(f), { initialProps: { f: filters() } });
    expect(a.open).toBe(false);
  });

  it("force-opens a group that still has a visible row once a filter is active", () => {
    const [a, b] = build([[{ hidden: false }], [{ hidden: true }]]);
    renderHook(({ f }) => useFilterAccordions(f), { initialProps: { f: filters({ search: "two sum" }) } });
    expect(a.open).toBe(true);
    expect(b.open).toBe(false); // nothing matched inside, so it stays shut
  });

  it("restores the previous open state when the filter is cleared", () => {
    const [a, b] = build([[{ hidden: false }], [{ hidden: false }]]);
    a.open = true; // the user had this one open before searching
    const { rerender } = renderHook(({ f }) => useFilterAccordions(f), { initialProps: { f: filters() } });

    rerender({ f: filters({ search: "two sum" }) });
    expect(a.open).toBe(true);
    expect(b.open).toBe(true); // force-opened by the search

    rerender({ f: filters() });
    expect(a.open).toBe(true); // as the user left it
    expect(b.open).toBe(false); // returned to closed
  });

  it("treats any filter, not just search, as active", () => {
    const [a] = build([[{ hidden: false }]]);
    renderHook(({ f }) => useFilterAccordions(f), { initialProps: { f: filters({ difficulty: "Hard" }) } });
    expect(a.open).toBe(true);
  });

  it("does not re-snapshot on every keystroke while a filter stays active", () => {
    const [a] = build([[{ hidden: false }]]);
    const { rerender } = renderHook(({ f }) => useFilterAccordions(f), { initialProps: { f: filters() } });
    rerender({ f: filters({ search: "t" }) });
    a.open = false; // the user manually closes it mid-search
    rerender({ f: filters({ search: "tw" }) });
    rerender({ f: filters() });
    // Restores the pre-search state, not the mid-search one.
    expect(a.open).toBe(false);
  });
});

describe("backup file download", () => {
  it("writes a date-stamped JSON file", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    downloadBackupFile('{"version":1}');
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:x");
    // the anchor is cleaned up rather than left in the document
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("copies the legacy keys into IDB before migration, and downloads a copy", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    return backupLegacy('{"legacy":true}', '{"undo":true}').then(() => {
      expect(idb.set).toHaveBeenCalledWith(LEGACY_BACKUP_KEY, '{"legacy":true}');
      expect(idb.set).toHaveBeenCalledWith(LEGACY_BACKUP_UNDO_KEY, '{"undo":true}');
      expect(create).toHaveBeenCalledOnce();
    });
  });

  it("skips the undo key when there isn't one", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    await backupLegacy('{"legacy":true}', null);
    expect(idb.set).toHaveBeenCalledTimes(1);
    expect(idb.set).toHaveBeenCalledWith(LEGACY_BACKUP_KEY, '{"legacy":true}');
  });
});
