import { describe, expect, it } from "vitest";
import { emptyAppStoreV2 } from "./persistence/migrate";
import { buildRevisedByDate, mergeNotes, mergeStoresV2, summarizeMergeV2, v2Reducer } from "./store";
import type { AppStoreV2, QuestionProgressV2, RevisionAttempt, TopicRevision } from "./types";

// Phase 8's merge suite. The governing rule under test throughout: a merge
// may only ever ADD. Nothing solved is un-solved, no note, mistake, attempt
// or history entry is lost, and merging the same file twice changes nothing
// the second time.

function progress(patch: Partial<QuestionProgressV2> = {}): QuestionProgressV2 {
  return {
    completed: false,
    starred: false,
    starredAt: null,
    firstCompletedAt: null,
    lastCompletedAt: null,
    completionGateVersion: null,
    approach: "",
    pseudocode: "",
    code: "",
    notes: { legacy: "", approach: "", keyInsight: "", commonMistake: "", complexity: "", edgeCases: "", reminder: "" },
    mistakes: [],
    revisionStats: { count: 0, lastRevisedAt: null, lastScore: null, lastConfidence: null },
    ...patch,
  };
}

function revision(patch: Partial<TopicRevision> = {}): TopicRevision {
  return {
    topicId: "arrays",
    cycle: 0,
    nextDueAt: null,
    lastPassedAt: null,
    lastFailedAt: null,
    activeSessionId: null,
    history: [],
    weakConcepts: {},
    ...patch,
  };
}

function attempt(patch: Partial<RevisionAttempt> = {}): RevisionAttempt {
  return {
    id: "a1",
    topicId: "arrays",
    startedAt: "2026-01-01T00:00:00.000Z",
    submittedAt: "2026-01-01T00:30:00.000Z",
    fundamentals: [],
    questions: [],
    evaluationStatus: "PENDING",
    evaluation: null,
    error: null,
    ...patch,
  };
}

function storeWith(patch: Partial<AppStoreV2>): AppStoreV2 {
  return { ...emptyAppStoreV2(), ...patch };
}

describe("mergeStoresV2 -- completion never regresses", () => {
  it("keeps a problem solved when only the incoming copy has it", () => {
    const local = storeWith({ progress: { q: progress({ completed: false }) } });
    const incoming = storeWith({ progress: { q: progress({ completed: true, firstCompletedAt: "2026-02-01", lastCompletedAt: "2026-02-01" }) } });
    expect(mergeStoresV2(local, incoming).progress.q.completed).toBe(true);
  });

  it("keeps a problem solved when only the local copy has it", () => {
    const local = storeWith({ progress: { q: progress({ completed: true, firstCompletedAt: "2026-02-01" }) } });
    const incoming = storeWith({ progress: { q: progress({ completed: false }) } });
    expect(mergeStoresV2(local, incoming).progress.q.completed).toBe(true);
  });

  it("takes the earliest first completion and the latest last completion", () => {
    const local = storeWith({ progress: { q: progress({ completed: true, firstCompletedAt: "2026-03-01", lastCompletedAt: "2026-03-01" }) } });
    const incoming = storeWith({ progress: { q: progress({ completed: true, firstCompletedAt: "2026-01-01", lastCompletedAt: "2026-05-01" }) } });
    const merged = mergeStoresV2(local, incoming).progress.q;
    expect(merged.firstCompletedAt).toBe("2026-01-01");
    expect(merged.lastCompletedAt).toBe("2026-05-01");
  });

  it("brings across a question the local store has never seen", () => {
    const local = emptyAppStoreV2();
    const incoming = storeWith({ progress: { brandNew: progress({ completed: true }) } });
    expect(mergeStoresV2(local, incoming).progress.brandNew.completed).toBe(true);
  });

  it("keeps a gate-verified completion verified", () => {
    const local = storeWith({ progress: { q: progress({ completed: true, completionGateVersion: null }) } });
    const incoming = storeWith({ progress: { q: progress({ completed: true, completionGateVersion: 1 }) } });
    expect(mergeStoresV2(local, incoming).progress.q.completionGateVersion).toBe(1);
  });
});

describe("mergeStoresV2 -- no written work is lost", () => {
  it("combines differing structured note fields per field, preserving legacy", () => {
    const local = storeWith({
      progress: { q: progress({ notes: { ...progress().notes, legacy: "old blob", keyInsight: "mine" } }) },
    });
    const incoming = storeWith({
      progress: { q: progress({ notes: { ...progress().notes, legacy: "old blob", keyInsight: "theirs", edgeCases: "empty array" } }) },
    });
    const merged = mergeStoresV2(local, incoming).progress.q;
    expect(merged.notes.keyInsight).toBe("mine\n\n--- merged ---\n\ntheirs");
    expect(merged.notes.legacy).toBe("old blob"); // identical text isn't duplicated
    expect(merged.notes.edgeCases).toBe("empty array");
  });

  it("combines approach/pseudocode/code rather than picking a winner", () => {
    const local = storeWith({ progress: { q: progress({ pseudocode: "mine", code: "" }) } });
    const incoming = storeWith({ progress: { q: progress({ pseudocode: "theirs", code: "def f(): pass" }) } });
    const merged = mergeStoresV2(local, incoming).progress.q;
    expect(merged.pseudocode).toContain("mine");
    expect(merged.pseudocode).toContain("theirs");
    expect(merged.code).toBe("def f(): pass");
  });

  it("unions mistakes and de-duplicates identical ones", () => {
    const shared = { at: "2026-01-01T00:00:00.000Z", what: "off by one", remember: "check bounds" };
    const local = storeWith({ progress: { q: progress({ mistakes: [shared, { at: "2026-02-01T00:00:00.000Z", what: "mine", remember: "x" }] }) } });
    const incoming = storeWith({ progress: { q: progress({ mistakes: [shared, { at: "2026-03-01T00:00:00.000Z", what: "theirs", remember: "y" }] }) } });
    const merged = mergeStoresV2(local, incoming).progress.q.mistakes;
    expect(merged).toHaveLength(3);
    expect(merged.map((m) => m.at)).toEqual([...merged.map((m) => m.at)].sort());
  });

  it("takes the highest revision count and the latest revision date", () => {
    const local = storeWith({ progress: { q: progress({ revisionStats: { count: 1, lastRevisedAt: "2026-01-01", lastScore: 50, lastConfidence: "forgot" } }) } });
    const incoming = storeWith({ progress: { q: progress({ revisionStats: { count: 4, lastRevisedAt: "2026-06-01", lastScore: 90, lastConfidence: "strong" } }) } });
    const merged = mergeStoresV2(local, incoming).progress.q.revisionStats;
    expect(merged.count).toBe(4);
    expect(merged.lastRevisedAt).toBe("2026-06-01");
    // The more-revised side's last-attempt facts travel together.
    expect(merged.lastScore).toBe(90);
    expect(merged.lastConfidence).toBe("strong");
  });

  it("never drops an orphaned entry from either side", () => {
    const local = storeWith({ orphanedProgress: { mine: progress({ completed: true }) } });
    const incoming = storeWith({ orphanedProgress: { theirs: progress({ completed: true }) } });
    const merged = mergeStoresV2(local, incoming).orphanedProgress;
    expect(Object.keys(merged).sort()).toEqual(["mine", "theirs"]);
  });
});

describe("mergeStoresV2 -- revision namespace", () => {
  it("unions history by attempt id and keeps it ordered", () => {
    const local = storeWith({ revision: { arrays: revision({ history: [{ at: "2026-01-01", score: 60, passed: false, attemptId: "a1" }] }) } });
    const incoming = storeWith({ revision: { arrays: revision({ history: [{ at: "2026-02-01", score: 90, passed: true, attemptId: "a2" }] }) } });
    const merged = mergeStoresV2(local, incoming).revision.arrays.history;
    expect(merged.map((h) => h.attemptId)).toEqual(["a1", "a2"]);
  });

  it("takes the scheduling block from the side that has passed more cycles", () => {
    const local = storeWith({ revision: { arrays: revision({ cycle: 1, nextDueAt: "2026-02-01" }) } });
    const incoming = storeWith({ revision: { arrays: revision({ cycle: 3, nextDueAt: "2026-09-01", lastPassedAt: "2026-08-01" }) } });
    const merged = mergeStoresV2(local, incoming).revision.arrays;
    expect(merged.cycle).toBe(3);
    expect(merged.nextDueAt).toBe("2026-09-01");
    expect(merged.lastPassedAt).toBe("2026-08-01");
  });

  it("takes weak-concept weights as a max, so re-merging can't inflate them", () => {
    const local = storeWith({ revision: { arrays: revision({ weakConcepts: { c1: 3, c2: 1 } }) } });
    const incoming = storeWith({ revision: { arrays: revision({ weakConcepts: { c1: 2, c3: 5 } }) } });
    expect(mergeStoresV2(local, incoming).revision.arrays.weakConcepts).toEqual({ c1: 3, c2: 1, c3: 5 });
  });

  it("never imports another device's in-progress session", () => {
    const local = storeWith({ revision: { arrays: revision({ activeSessionId: null }) } });
    const incoming = storeWith({ revision: { arrays: revision({ activeSessionId: "their-session" }) } });
    expect(mergeStoresV2(local, incoming).revision.arrays.activeSessionId).toBeNull();
  });

  it("strips the active session from a topic the local store has never seen", () => {
    const incoming = storeWith({ revision: { graphs: revision({ topicId: "graphs", activeSessionId: "their-session" }) } });
    expect(mergeStoresV2(emptyAppStoreV2(), incoming).revision.graphs.activeSessionId).toBeNull();
  });
});

describe("mergeStoresV2 -- attempts and settings", () => {
  it("unions attempts from both sides", () => {
    const local = storeWith({ attempts: { a1: attempt({ id: "a1" }) } });
    const incoming = storeWith({ attempts: { a2: attempt({ id: "a2" }) } });
    expect(Object.keys(mergeStoresV2(local, incoming).attempts).sort()).toEqual(["a1", "a2"]);
  });

  it("keeps the local copy of a colliding attempt id", () => {
    const local = storeWith({ attempts: { a1: attempt({ id: "a1", evaluationStatus: "OK" }) } });
    const incoming = storeWith({ attempts: { a1: attempt({ id: "a1", evaluationStatus: "PENDING" }) } });
    expect(mergeStoresV2(local, incoming).attempts.a1.evaluationStatus).toBe("OK");
  });

  it("never takes the other device's settings", () => {
    const local = v2Reducer(emptyAppStoreV2(), { type: "SET_SETTINGS", patch: { apiKey: "mine", provider: "gemini" } });
    const incoming = v2Reducer(emptyAppStoreV2(), { type: "SET_SETTINGS", patch: { apiKey: "theirs", provider: "grok" } });
    const merged = mergeStoresV2(local, incoming);
    expect(merged.settings.apiKey).toBe("mine");
    expect(merged.settings.provider).toBe("gemini");
  });
});

describe("mergeStoresV2 -- idempotence", () => {
  it("merging the same file twice is a no-op the second time", () => {
    const local = storeWith({
      progress: { q: progress({ completed: true, notes: { ...progress().notes, keyInsight: "mine" }, mistakes: [{ at: "2026-01-01T00:00:00.000Z", what: "x", remember: "y" }] }) },
      revision: { arrays: revision({ cycle: 1, history: [{ at: "2026-01-01", score: 80, passed: true, attemptId: "a1" }], weakConcepts: { c1: 2 } }) },
      attempts: { a1: attempt() },
    });
    const incoming = storeWith({
      progress: { q: progress({ completed: true, notes: { ...progress().notes, keyInsight: "theirs" }, mistakes: [{ at: "2026-02-01T00:00:00.000Z", what: "z", remember: "w" }] }) },
      revision: { arrays: revision({ cycle: 2, history: [{ at: "2026-02-01", score: 90, passed: true, attemptId: "a2" }], weakConcepts: { c1: 5 } }) },
      attempts: { a2: attempt({ id: "a2" }) },
    });

    const once = mergeStoresV2(local, incoming);
    const twice = mergeStoresV2(once, incoming);
    expect(twice).toEqual(once);
  });
});

describe("summarizeMergeV2 -- the dry run matches what gets applied", () => {
  it("counts exactly what the merged store adds", () => {
    const local = storeWith({ progress: { q: progress({ completed: false }) } });
    const incoming = storeWith({
      progress: {
        q: progress({ completed: true, starred: true, notes: { ...progress().notes, keyInsight: "new" }, mistakes: [{ at: "2026-01-01T00:00:00.000Z", what: "x", remember: "y" }] }),
      },
      revision: { arrays: revision({ history: [{ at: "2026-01-01", score: 90, passed: true, attemptId: "a1" }] }) },
      attempts: { a1: attempt() },
    });

    const merged = mergeStoresV2(local, incoming);
    const summary = summarizeMergeV2(local, merged);
    expect(summary).toEqual({
      newlySolved: 1,
      newlyStarred: 1,
      notesCombined: 1,
      mistakesAdded: 1,
      attemptsAdded: 1,
      revisionsRecorded: 1,
    });
  });

  it("reports nothing at all when the incoming file adds nothing", () => {
    const local = storeWith({ progress: { q: progress({ completed: true }) } });
    const merged = mergeStoresV2(local, local);
    expect(summarizeMergeV2(local, merged)).toEqual({
      newlySolved: 0,
      newlyStarred: 0,
      notesCombined: 0,
      mistakesAdded: 0,
      attemptsAdded: 0,
      revisionsRecorded: 0,
    });
  });
});

describe("buildRevisedByDate -- the heatmap's revised series", () => {
  it("counts questions recalled per submitted attempt, not sessions", () => {
    const v2 = storeWith({
      attempts: {
        a1: attempt({ id: "a1", submittedAt: "2026-01-05T12:00:00.000Z", questions: [{ questionId: "q1", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: "strong" }, { questionId: "q2", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: "partial" }] }),
      },
    });
    expect(buildRevisedByDate(v2).get("2026-01-05")).toBe(2);
  });

  it("keeps the whole history, not just the most recent revision", () => {
    const q = [{ questionId: "q1", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: "strong" as const }];
    const v2 = storeWith({
      attempts: {
        a1: attempt({ id: "a1", submittedAt: "2026-01-05T12:00:00.000Z", questions: q }),
        a2: attempt({ id: "a2", submittedAt: "2026-03-09T12:00:00.000Z", questions: q }),
      },
    });
    const map = buildRevisedByDate(v2);
    expect(map.get("2026-01-05")).toBe(1);
    expect(map.get("2026-03-09")).toBe(1);
  });

  it("ignores an unsubmitted draft session", () => {
    const v2 = storeWith({
      attempts: { a1: attempt({ submittedAt: null, questions: [{ questionId: "q1", approach: "", pseudocode: "", complexity: "", edgeCases: "", confidence: null }] }) },
    });
    expect(buildRevisedByDate(v2).size).toBe(0);
  });

  it("does not plot ★ bookmark dates -- those stay bookmarks (decision #16)", () => {
    const v2 = storeWith({ progress: { q: progress({ starred: true, starredAt: "2026-04-04" }) } });
    expect(buildRevisedByDate(v2).size).toBe(0);
  });
});

describe("mergeNotes -- re-merging must not grow notes without bound", () => {
  it("treats an already-merged note as its parts, so a repeat merge adds nothing", () => {
    const first = mergeNotes("mine", "theirs");
    expect(first).toBe("mine\n\n--- merged ---\n\ntheirs");
    expect(mergeNotes(first, "theirs")).toBe(first);
    expect(mergeNotes(first, "mine")).toBe(first);
    expect(mergeNotes(first, first)).toBe(first);
  });

  it("still appends genuinely new text", () => {
    const first = mergeNotes("mine", "theirs");
    expect(mergeNotes(first, "a third note")).toBe("mine\n\n--- merged ---\n\ntheirs\n\n--- merged ---\n\na third note");
  });
});
