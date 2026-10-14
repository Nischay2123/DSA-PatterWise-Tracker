import { describe, expect, it } from "vitest";
import { MOVED_IDS, emptyAppStoreV2, isValidAppStoreV2, liftV1Entry, migrateV1ToV2, renameMovedIds, renameMovedIdsV1 } from "./migrate";
import type { AppStoreV2, ProblemState, ProgressStore } from "../types";

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
      completionGateVersion: null,
      gradedAt: null,
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

  describe("completionGateVersion grandfathering", () => {
    it("a migrated completed question is grandfathered (null gate version)", () => {
      const store: ProgressStore = { version: 1, idsMigrated: true, problems: { a: state({ done: true, completedAt: "2026-01-01" }) } };
      expect(migrateV1ToV2(store).progress.a.completionGateVersion).toBeNull();
    });

    it("a migrated incomplete question is also null (moot until it's ever completed)", () => {
      const store: ProgressStore = { version: 1, idsMigrated: true, problems: { a: state({ done: false }) } };
      expect(migrateV1ToV2(store).progress.a.completionGateVersion).toBeNull();
    });

    it("migration is idempotent with respect to completionGateVersion too", () => {
      const store: ProgressStore = { version: 1, idsMigrated: true, problems: { a: state({ done: true, completedAt: "2026-01-01" }) } };
      const first = migrateV1ToV2(store);
      const second = migrateV1ToV2(store);
      expect(first.progress.a.completionGateVersion).toBe(second.progress.a.completionGateVersion);
    });
  });
});

describe("isValidAppStoreV2", () => {
  it("accepts a well-formed v2 store", () => {
    expect(isValidAppStoreV2(emptyAppStoreV2())).toBe(true);
  });

  it("rejects null, arrays, and wrong schemaVersion", () => {
    expect(isValidAppStoreV2(null)).toBe(false);
    expect(isValidAppStoreV2([])).toBe(false);
    expect(isValidAppStoreV2({ ...emptyAppStoreV2(), schemaVersion: 1 })).toBe(false);
  });

  it("rejects a record missing required namespaces even with the right schemaVersion", () => {
    expect(isValidAppStoreV2({ schemaVersion: 2 })).toBe(false);
    expect(isValidAppStoreV2({ schemaVersion: 2, progress: {} })).toBe(false); // missing revision/attempts/etc.
  });

  it("rejects a record whose namespaces are arrays instead of objects", () => {
    const malformed = { ...emptyAppStoreV2(), progress: [] } as unknown as AppStoreV2;
    expect(isValidAppStoreV2(malformed)).toBe(false);
  });
});

describe("renameMovedIds", () => {
  const OLD = "binary-search__classic-search__search-in-a-2d-matrix";
  const NEW = "binary-search__2d-search__search-in-a-2d-matrix";
  const entry = (notes: string) => ({ ...liftV1Entry(state({ done: true, completedAt: "2026-08-01" })), code: notes });
  const v2 = (patch: Partial<AppStoreV2>): AppStoreV2 => ({ ...emptyAppStoreV2(), ...patch });

  it("every moved id lands on a real problem, and none is renamed twice", async () => {
    const data = (await import("../../data/questions.json")).default as { topics: { patterns: { problems: { id: string }[] }[] }[] };
    const ids = new Set(data.topics.flatMap((t) => t.patterns.flatMap((p) => p.problems.map((q) => q.id))));
    for (const [from, to] of Object.entries(MOVED_IDS)) {
      expect(ids.has(to)).toBe(true);
      expect(ids.has(from)).toBe(false);
      expect(to in MOVED_IDS).toBe(false);
    }
  });

  it("returns the same object when nothing moved, so a boot doesn't re-save", () => {
    const store = v2({ progress: { "arrays__two-pointers__two-sum": entry("x") } });
    expect(renameMovedIds(store)).toBe(store);
  });

  it("re-keys a moved problem's whole entry and leaves the rest alone", () => {
    const store = v2({ progress: { [OLD]: entry("mine"), "arrays__two-pointers__two-sum": entry("other") } });
    const out = renameMovedIds(store);
    expect(out.progress).toEqual({ [NEW]: entry("mine"), "arrays__two-pointers__two-sum": entry("other") });
    expect(store.progress[OLD]).toEqual(entry("mine")); // input untouched
  });

  it("keeps an entry already under the new id and orphans the old one instead of dropping it", () => {
    const out = renameMovedIds(v2({ progress: { [OLD]: entry("old"), [NEW]: entry("new") } }));
    expect(out.progress).toEqual({ [NEW]: entry("new") });
    expect(out.orphanedProgress).toEqual({ [OLD]: entry("old") });
  });

  it("renames question ids inside revision attempts", () => {
    const attempt = {
      id: "a1", topicId: "binary-search", startedAt: "2026-08-01", submittedAt: null, fundamentals: [],
      questions: [{ questionId: OLD, approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: null }],
      evaluationStatus: "OK",
      evaluation: { passed: true, score: 90, perFundamental: [], weakConcepts: [], feedback: "", recommendedFocus: [],
        perQuestion: [{ questionId: OLD, correctness: 5, approach: 5, pseudocode: 5, complexity: 5, mistakes: [], note: "" }] },
      error: null,
    } as AppStoreV2["attempts"][string];
    const out = renameMovedIds(v2({ attempts: { a1: attempt } }));
    expect(out.attempts.a1.questions[0].questionId).toBe(NEW);
    expect(out.attempts.a1.evaluation!.perQuestion[0].questionId).toBe(NEW);
  });

  it("v1 stores and the frozen p-ids land on the new ids too", () => {
    expect(Object.keys(renameMovedIdsV1({ [OLD]: state({ done: true }) }))).toEqual([NEW]);
    // p121 is the frozen idMap.json bridge to the old id.
    expect(Object.keys(migrateV1ToV2({ version: 1, problems: { p121: state({ done: true }) } }).progress)).toEqual([NEW]);
  });
});
