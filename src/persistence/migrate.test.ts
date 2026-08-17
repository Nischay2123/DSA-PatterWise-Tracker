import { describe, expect, it } from "vitest";
import { emptyAppStoreV2, liftV1Entry, migrateV1ToV2 } from "./migrate";
import type { ProblemState, ProgressStore } from "../types";

function state(patch: Partial<ProblemState> = {}): ProblemState {
  return { done: false, revise: false, notes: "", completedAt: null, revisedAt: null, ...patch };
}

describe("migrateV1ToV2", () => {
  it("handles an absent store", () => {
    expect(migrateV1ToV2(undefined)).toEqual(emptyAppStoreV2());
    expect(migrateV1ToV2(null)).toEqual(emptyAppStoreV2());
  });

  it("handles an empty store", () => {
    const store: ProgressStore = { version: 1, problems: {} };
    expect(migrateV1ToV2(store)).toEqual(emptyAppStoreV2());
  });

  it("handles corrupt shapes gracefully instead of throwing", () => {
    expect(() => migrateV1ToV2({ version: 1 } as unknown as ProgressStore)).not.toThrow();
    expect(migrateV1ToV2({ version: 1 } as unknown as ProgressStore)).toEqual(emptyAppStoreV2());
  });

  it("maps a stable-id (already-migrated) store's entry field-for-field", () => {
    const store: ProgressStore = {
      version: 1,
      idsMigrated: true,
      problems: {
        "arrays__two-pointers__two-sum": state({
          done: true,
          revise: true,
          notes: "clean approach",
          completedAt: "2026-01-10",
          revisedAt: "2026-01-15",
        }),
      },
    };
    const v2 = migrateV1ToV2(store);
    expect(v2.progress["arrays__two-pointers__two-sum"]).toEqual({
      completed: true,
      starred: true,
      starredAt: "2026-01-15",
      firstCompletedAt: "2026-01-10",
      lastCompletedAt: "2026-01-10",
      approach: "",
      pseudocode: "",
      code: "",
      notes: {
        legacy: "clean approach",
        approach: "",
        keyInsight: "",
        commonMistake: "",
        complexity: "",
        edgeCases: "",
        reminder: "",
      },
      mistakes: [],
      revisionStats: { count: 0, lastRevisedAt: null, lastScore: null, lastConfidence: null },
    });
    expect(v2.orphanedProgress).toEqual({});
  });

  it("already-stable-id stores (idsMigrated: true) pass through unchanged -- no idMap lookup", () => {
    const store: ProgressStore = {
      version: 1,
      idsMigrated: true,
      problems: { "not-a-real-id": state({ done: true }) },
    };
    const v2 = migrateV1ToV2(store);
    // Even though "not-a-real-id" isn't in idMap.json, idsMigrated:true means it's
    // trusted as already-stable and must NOT be treated as unmapped/orphaned.
    expect(v2.progress["not-a-real-id"]).toBeDefined();
    expect(v2.orphanedProgress).toEqual({});
  });

  it("maps legacy positional ids (p1..p467) through idMap.json when not yet migrated", () => {
    const store: ProgressStore = { version: 1, problems: { p1: state({ done: true, notes: "old note" }) } };
    const v2 = migrateV1ToV2(store);
    expect(v2.progress["fundamentals__language-basics__stl"]).toBeDefined();
    expect(v2.progress["fundamentals__language-basics__stl"].completed).toBe(true);
    expect(v2.progress["fundamentals__language-basics__stl"].notes.legacy).toBe("old note");
    expect(v2.progress.p1).toBeUndefined();
  });

  it("parks unmapped ids in orphanedProgress instead of dropping them", () => {
    const store: ProgressStore = { version: 1, problems: { p99999: state({ done: true, notes: "keep me" }) } };
    const v2 = migrateV1ToV2(store);
    expect(v2.progress.p99999).toBeUndefined();
    expect(v2.orphanedProgress.p99999).toBeDefined();
    expect(v2.orphanedProgress.p99999.notes.legacy).toBe("keep me");
  });

  it("preserves a real completedAt into both firstCompletedAt and lastCompletedAt", () => {
    const entry = liftV1Entry(state({ completedAt: "2025-12-25" }));
    expect(entry.firstCompletedAt).toBe("2025-12-25");
    expect(entry.lastCompletedAt).toBe("2025-12-25");
  });

  it("never fabricates a date -- absent completedAt stays null", () => {
    const entry = liftV1Entry(state({ completedAt: null }));
    expect(entry.firstCompletedAt).toBeNull();
    expect(entry.lastCompletedAt).toBeNull();
  });

  it("maps revisedAt to starredAt, and never seeds revisionStats.lastRevisedAt from it", () => {
    const entry = liftV1Entry(state({ revise: true, revisedAt: "2026-02-01" }));
    expect(entry.starredAt).toBe("2026-02-01");
    expect(entry.revisionStats.lastRevisedAt).toBeNull();
  });

  it("migrates a mixed store (some dated, some not) correctly in one pass", () => {
    const store: ProgressStore = {
      version: 1,
      idsMigrated: true,
      problems: {
        a: state({ done: true, completedAt: "2026-01-01" }),
        b: state({ done: false, completedAt: null }),
        c: state({ revise: true, revisedAt: "2026-01-05" }),
      },
    };
    const v2 = migrateV1ToV2(store);
    expect(v2.progress.a.firstCompletedAt).toBe("2026-01-01");
    expect(v2.progress.b.firstCompletedAt).toBeNull();
    expect(v2.progress.b.completed).toBe(false);
    expect(v2.progress.c.starredAt).toBe("2026-01-05");
  });

  it("running migration twice on the same input is idempotent (pure function, no shared state)", () => {
    const store: ProgressStore = { version: 1, idsMigrated: true, problems: { a: state({ done: true }) } };
    expect(migrateV1ToV2(store)).toEqual(migrateV1ToV2(store));
  });
});
