import { describe, expect, it } from "vitest";
import { emptyAppStoreV2 } from "../persistence/migrate";
import { mergeStoresV2, patchV2FromV1, todayISO, v2Reducer } from "../store";
import type { ProgressStore } from "../types";
import { applyReview, countDue, daysUntil, isCleanSolveOnly, isMastered, isReviewDue, mergeReview, scheduleSolve } from "./questionReview";

const T = "2026-03-01";

describe("the review ladder (1, 3, 7, 15, 30, 60 days)", () => {
  it("schedules nothing for a clean solve, and a review the next day for a hint or the solution", () => {
    expect(scheduleSolve("clean", T)).toBeUndefined();
    for (const o of ["hint", "solution"] as const) expect(scheduleSolve(o, T)).toMatchObject({ step: 0, dueAt: "2026-03-02" });
  });

  it("moves up a step on a clean review, repeats it on a hint, restarts on the solution", () => {
    const at2 = applyReview(applyReview(scheduleSolve("hint", T)!, "clean", T), "clean", T);
    expect(at2).toMatchObject({ step: 2, dueAt: "2026-03-08" });
    expect(applyReview(at2, "hint", T)).toMatchObject({ step: 2, dueAt: "2026-03-08" });
    expect(applyReview(at2, "solution", T)).toMatchObject({ step: 0, dueAt: "2026-03-02" });
    expect(applyReview(at2, "hint", T).log.map((l) => l.kind)).toEqual(["solve", "review", "review", "review"]);
  });

  it("masters only on a clean pass of the last step", () => {
    let r = scheduleSolve("hint", T)!;
    for (let i = 0; i < 5; i++) r = applyReview(r, "clean", T);
    expect(r).toMatchObject({ step: 5, dueAt: "2026-04-30" }); // the 60-day wait
    expect(isMastered(applyReview(r, "hint", T))).toBe(false);
    expect(isMastered(applyReview(r, "clean", T))).toBe(true);
  });

  it("starts a schedule for a question solved before reviews existed", () => {
    expect(applyReview(undefined, "clean", T)).toMatchObject({ step: 1, dueAt: "2026-03-04", log: [{ kind: "review" }] });
  });

  it("is due on and after its date, and never for an undone question", () => {
    const review = scheduleSolve("hint", T)!;
    expect(isReviewDue({ completed: true, review }, "2026-03-01")).toBe(false);
    expect(isReviewDue({ completed: true, review }, "2026-03-02")).toBe(true);
    expect(isReviewDue({ completed: false, review }, "2026-03-09")).toBe(false);
    expect(daysUntil("2026-03-02", T)).toBe(1);
  });

  it("keeps the longer history when merging two devices", () => {
    const short = scheduleSolve("hint", T)!;
    const long = applyReview(short, "clean", "2026-03-02");
    expect(mergeReview(short, long)).toBe(long);
    expect(mergeReview(long, short)).toBe(long);
    expect(mergeReview(undefined, short)).toBe(short);
  });
});

describe("wired into completion", () => {
  const today = todayISO();
  const tomorrow = scheduleSolve("hint", today)!.dueAt!;
  const v1 = (done: boolean, completedAt = today): ProgressStore => ({
    version: 1,
    idsMigrated: true,
    problems: { q: { done, revise: false, notes: "", completedAt: done ? completedAt : null, revisedAt: null } },
  });

  it("schedules nothing on an ordinary (clean) tick", () => {
    expect(patchV2FromV1(emptyAppStoreV2(), v1(true)).progress.q.review).toBeUndefined();
  });

  it("schedules a hint solve recorded with the tick, and clears it on untick", () => {
    const solved = v2Reducer(emptyAppStoreV2(), { type: "RECORD_SOLVE", id: "q", outcome: "hint", at: today });
    const done = patchV2FromV1(solved, v1(true));
    expect(done.progress.q.review).toMatchObject({ step: 0, dueAt: tomorrow, log: [{ outcome: "hint" }] });
    expect(countDue(done.progress, tomorrow)).toBe(1);
    expect(patchV2FromV1(done, v1(false)).progress.q.review).toBeUndefined();
    // Picking "clean" afterwards takes it off the ladder again.
    expect(v2Reducer(done, { type: "RECORD_SOLVE", id: "q", outcome: "clean", at: today }).progress.q.review).toBeUndefined();
  });

  it("drops a schedule left over from a clean solve under the old rule", () => {
    const legacy = emptyAppStoreV2();
    legacy.progress.q = {
      ...patchV2FromV1(emptyAppStoreV2(), v1(true)).progress.q,
      review: { step: 0, dueAt: tomorrow, log: [{ at: today, kind: "solve", outcome: "clean" }] },
    };
    expect(isCleanSolveOnly(legacy.progress.q.review)).toBe(true);
    expect(patchV2FromV1(legacy, v1(true)).progress.q.review).toBeUndefined();
  });

  it("leaves an imported completion with an old date unscheduled", () => {
    expect(patchV2FromV1(emptyAppStoreV2(), v1(true, "2025-01-01")).progress.q.review).toBeUndefined();
  });

  it("keeps the outcome CompletionPanel recorded just before the tick", () => {
    const solved = v2Reducer(emptyAppStoreV2(), { type: "RECORD_SOLVE", id: "q", outcome: "solution", at: today });
    const done = patchV2FromV1(solved, v1(true));
    expect(done.progress.q.review!.log).toEqual([{ at: today, kind: "solve", outcome: "solution" }]);
    // ...and later patches of the same done question leave it alone.
    const reviewed = v2Reducer(done, { type: "RECORD_REVIEW", id: "q", outcome: "clean", at: tomorrow });
    expect(patchV2FromV1(reviewed, v1(true)).progress.q.review!.step).toBe(1);
  });

  it("survives a device merge", () => {
    const a = patchV2FromV1(emptyAppStoreV2(), v1(true));
    const b = v2Reducer(a, { type: "RECORD_REVIEW", id: "q", outcome: "clean", at: tomorrow });
    expect(mergeStoresV2(a, b).progress.q.review!.step).toBe(1);
  });
});
