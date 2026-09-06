import { describe, expect, it } from "vitest";
import { deriveState, isTopicGated } from "./stateMachine";
import type { TopicRevision } from "../types";

const NOW = new Date("2026-06-15T12:00:00.000Z");

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

describe("deriveState -- every branch of the table, reachable and isolated", () => {
  it("NOT_STARTED: completion is zero", () => {
    expect(deriveState(revision(), 0, false, NOW)).toBe("NOT_STARTED");
  });

  it("IN_PROGRESS: 0 < completion < threshold", () => {
    expect(deriveState(revision(), 0.4, false, NOW)).toBe("IN_PROGRESS");
  });

  it("threshold boundary: 74.9% is still IN_PROGRESS", () => {
    expect(deriveState(revision(), 0.749, false, NOW)).toBe("IN_PROGRESS");
  });

  it("threshold boundary: 75.0% crosses into scheduled/due territory", () => {
    const r = revision({ nextDueAt: "2026-07-01" }); // not due yet
    expect(deriveState(r, 0.75, false, NOW)).toBe("REVISION_SCHEDULED");
  });

  it("REVISION_SCHEDULED: at/above threshold, now < nextDueAt", () => {
    const r = revision({ nextDueAt: "2026-06-16" });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_SCHEDULED");
  });

  it("REVISION_DUE: at/above threshold, now >= nextDueAt, no prior failure", () => {
    const r = revision({ nextDueAt: "2026-06-15" });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_DUE");
  });

  it("REVISION_DUE: at/above threshold, nextDueAt never set (defaults to due)", () => {
    const r = revision({ nextDueAt: null });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_DUE");
  });

  it("REVISION_FAILED: due, and the last history entry failed", () => {
    const r = revision({
      nextDueAt: "2026-06-10",
      history: [{ at: "2026-06-01", score: 50, passed: false, attemptId: "a1" }],
    });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_FAILED");
  });

  it("REVISION_DUE, not FAILED, when the last history entry passed", () => {
    const r = revision({
      nextDueAt: "2026-06-10",
      history: [{ at: "2026-06-01", score: 90, passed: true, attemptId: "a1" }],
    });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_DUE");
  });

  it("REVISION_IN_PROGRESS: an active session overrides everything else", () => {
    const r = revision({ activeSessionId: "s1", nextDueAt: "2026-06-10" });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_IN_PROGRESS");
  });

  it("REVISION_IN_PROGRESS wins even over a failed-and-due history", () => {
    const r = revision({
      activeSessionId: "s1",
      nextDueAt: "2026-06-10",
      history: [{ at: "2026-06-01", score: 50, passed: false, attemptId: "a1" }],
    });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_IN_PROGRESS");
  });

  it("MASTERED: cycle at/above masteryCycles and 100% completion", () => {
    const r = revision({ cycle: 3, nextDueAt: "2026-06-10" });
    expect(deriveState(r, 1, false, NOW)).toBe("MASTERED");
  });

  it("MASTERED requires full completion, not just cycle count", () => {
    const r = revision({ cycle: 5, nextDueAt: "2026-06-10" });
    expect(deriveState(r, 0.9, false, NOW)).toBe("REVISION_DUE");
  });

  it("MASTERED wins over a due-and-failed history once achieved", () => {
    const r = revision({
      cycle: 4,
      nextDueAt: "2026-06-10",
      history: [{ at: "2026-06-01", score: 50, passed: false, attemptId: "a1" }],
    });
    expect(deriveState(r, 1, false, NOW)).toBe("MASTERED");
  });

  it("exempt topics are permanently NOT_STARTED/IN_PROGRESS regardless of any other field", () => {
    const r = revision({
      cycle: 10,
      nextDueAt: "2020-01-01",
      activeSessionId: "s1",
      history: [{ at: "2020-01-01", score: 10, passed: false, attemptId: "a1" }],
    });
    expect(deriveState(r, 0, true, NOW)).toBe("NOT_STARTED");
    expect(deriveState(r, 0.5, true, NOW)).toBe("IN_PROGRESS");
    expect(deriveState(r, 1, true, NOW)).toBe("IN_PROGRESS");
  });
});

describe("isTopicGated", () => {
  it("gates only REVISION_DUE and REVISION_FAILED", () => {
    const gated = ["REVISION_DUE", "REVISION_FAILED"] as const;
    const ungated = [
      "NOT_STARTED",
      "IN_PROGRESS",
      "REVISION_SCHEDULED",
      "REVISION_IN_PROGRESS",
      "MASTERED",
    ] as const;
    gated.forEach((s) => expect(isTopicGated(s)).toBe(true));
    ungated.forEach((s) => expect(isTopicGated(s)).toBe(false));
  });
});
