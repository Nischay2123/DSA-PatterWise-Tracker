import { describe, expect, it } from "vitest";
import { incrementWeakConcepts, recordAttemptOutcome, scheduleInitial } from "./scheduler";
import type { TopicRevision } from "../types";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function revision(patch: Partial<TopicRevision> = {}): TopicRevision {
  return {
    topicId: "arrays",
    cycle: 0,
    nextDueAt: null,
    lastPassedAt: null,
    lastFailedAt: null,
    activeSessionId: "s1",
    history: [],
    weakConcepts: {},
    ...patch,
  };
}

describe("scheduleInitial", () => {
  it("schedules 7 days out -- intervalDays[0], cycle is 0 at first crossing", () => {
    expect(scheduleInitial(NOW)).toBe("2026-06-22");
  });

  it("is exact across a DST boundary", () => {
    expect(scheduleInitial(new Date("2026-03-01T00:00:00.000Z"))).toBe("2026-03-08");
  });
});

describe("recordAttemptOutcome -- the full interval sequence 7/14/30/60/90, clamped", () => {
  it("first pass (cycle 0 -> 1): schedules intervalDays[1] = 14 days out", () => {
    const r = recordAttemptOutcome(revision({ cycle: 0 }), { passed: true, score: 90, attemptId: "a1" }, NOW);
    expect(r.cycle).toBe(1);
    expect(r.nextDueAt).toBe("2026-06-29"); // +14
  });

  it("second pass (cycle 1 -> 2): intervalDays[2] = 30 days out", () => {
    const r = recordAttemptOutcome(revision({ cycle: 1 }), { passed: true, score: 90, attemptId: "a2" }, NOW);
    expect(r.cycle).toBe(2);
    expect(r.nextDueAt).toBe("2026-07-15"); // +30
  });

  it("third pass (cycle 2 -> 3): intervalDays[3] = 60 days out", () => {
    const r = recordAttemptOutcome(revision({ cycle: 2 }), { passed: true, score: 90, attemptId: "a3" }, NOW);
    expect(r.cycle).toBe(3);
    expect(r.nextDueAt).toBe("2026-08-14"); // +60
  });

  it("fourth pass (cycle 3 -> 4): intervalDays[4] = 90 days out", () => {
    const r = recordAttemptOutcome(revision({ cycle: 3 }), { passed: true, score: 90, attemptId: "a4" }, NOW);
    expect(r.cycle).toBe(4);
    expect(r.nextDueAt).toBe("2026-09-13"); // +90
  });

  it("fifth+ pass (cycle 4 -> 5, and beyond): clamps to the last interval, 90 days", () => {
    const r5 = recordAttemptOutcome(revision({ cycle: 4 }), { passed: true, score: 90, attemptId: "a5" }, NOW);
    expect(r5.cycle).toBe(5);
    expect(r5.nextDueAt).toBe("2026-09-13"); // still +90, not out of bounds

    const r10 = recordAttemptOutcome(revision({ cycle: 9 }), { passed: true, score: 90, attemptId: "a10" }, NOW);
    expect(r10.cycle).toBe(10);
    expect(r10.nextDueAt).toBe("2026-09-13"); // still clamped at +90
  });

  it("records the pass in history and sets lastPassedAt", () => {
    const r = recordAttemptOutcome(revision({ cycle: 0 }), { passed: true, score: 85, attemptId: "a1" }, NOW);
    expect(r.history).toEqual([{ at: "2026-06-15", score: 85, passed: true, attemptId: "a1" }]);
    expect(r.lastPassedAt).toBe("2026-06-15");
  });
});

describe("recordAttemptOutcome -- fail does not advance", () => {
  it("leaves cycle and nextDueAt completely unchanged", () => {
    const before = revision({ cycle: 2, nextDueAt: "2026-06-10" });
    const after = recordAttemptOutcome(before, { passed: false, score: 40, attemptId: "a1" }, NOW);
    expect(after.cycle).toBe(2);
    expect(after.nextDueAt).toBe("2026-06-10");
  });

  it("records the fail in history and sets lastFailedAt, not lastPassedAt", () => {
    const after = recordAttemptOutcome(revision(), { passed: false, score: 40, attemptId: "a1" }, NOW);
    expect(after.history).toEqual([{ at: "2026-06-15", score: 40, passed: false, attemptId: "a1" }]);
    expect(after.lastFailedAt).toBe("2026-06-15");
    expect(after.lastPassedAt).toBeNull();
  });
});

describe("recordAttemptOutcome -- session lifecycle and weak concepts", () => {
  it("clears activeSessionId on both pass and fail -- the session concluded either way", () => {
    const pass = recordAttemptOutcome(revision({ activeSessionId: "s1" }), { passed: true, score: 90, attemptId: "a1" }, NOW);
    const fail = recordAttemptOutcome(revision({ activeSessionId: "s1" }), { passed: false, score: 40, attemptId: "a2" }, NOW);
    expect(pass.activeSessionId).toBeNull();
    expect(fail.activeSessionId).toBeNull();
  });

  it("increments weakConceptIds regardless of pass/fail", () => {
    const after = recordAttemptOutcome(
      revision({ weakConcepts: { c1: 1 } }),
      { passed: false, score: 40, attemptId: "a1", weakConceptIds: ["c1", "c2"] },
      NOW
    );
    expect(after.weakConcepts).toEqual({ c1: 2, c2: 1 });
  });
});

describe("incrementWeakConcepts", () => {
  it("is a no-op with an empty id list, returning the same reference", () => {
    const current = { c1: 1 };
    expect(incrementWeakConcepts(current, [])).toBe(current);
  });

  it("increments existing and seeds new ids independently", () => {
    expect(incrementWeakConcepts({ c1: 2 }, ["c1", "c2", "c2"])).toEqual({ c1: 3, c2: 2 });
  });
});
