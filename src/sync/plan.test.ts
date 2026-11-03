import { describe, expect, it } from "vitest";
import { emptyAppStoreV2, liftV1Entry } from "../persistence/migrate";
import { toExportableV2 } from "../store";
import type { AppStoreV2, QuestionProgressV2 } from "../types";
import { canonical, planSync } from "./plan";

const solved = (patch: Partial<QuestionProgressV2> = {}): QuestionProgressV2 => ({
  ...liftV1Entry({ done: true, revise: false, notes: "", completedAt: "2026-10-01", revisedAt: null }),
  ...patch,
});
const store = (progress: AppStoreV2["progress"], settings: Partial<AppStoreV2["settings"]> = {}): AppStoreV2 => {
  const s = emptyAppStoreV2();
  return { ...s, progress, settings: { ...s.settings, ...settings } };
};
const file = (s: AppStoreV2) => JSON.stringify(toExportableV2(s));
const A = "arrays__two-pointers__3-sum";
const B = "arrays__two-pointers__4-sum";

describe("planSync", () => {
  it("first device: nothing remote yet, so it uploads, without the API key", () => {
    const local = store({ [A]: solved() }, { apiKey: "secret" });
    const plan = planSync(local, null);
    expect(plan).toMatchObject({ push: true, applyLocal: false });
    expect(JSON.parse(plan.upload).settings.apiKey).toBe("");
    expect(JSON.parse(plan.upload).progress[A].completed).toBe(true);
  });

  it("already in step: nothing to apply, nothing to push", () => {
    const local = store({ [A]: solved() });
    expect(planSync(local, file(local))).toMatchObject({ push: false, applyLocal: false });
  });

  it("the other device solved something: apply it here, the gist already has it", () => {
    const local = store({ [A]: solved() });
    const plan = planSync(local, file(store({ [A]: solved(), [B]: solved() })));
    expect(plan).toMatchObject({ applyLocal: true, push: false });
    expect(plan.merged.progress[B].completed).toBe(true);
  });

  it("this device solved something: push it, nothing to apply", () => {
    const plan = planSync(store({ [A]: solved(), [B]: solved() }), file(store({ [A]: solved() })));
    expect(plan).toMatchObject({ applyLocal: false, push: true });
  });

  it("both moved on: apply and push the union", () => {
    const plan = planSync(store({ [A]: solved() }), file(store({ [B]: solved() })));
    expect(plan).toMatchObject({ applyLocal: true, push: true });
    expect(Object.keys(plan.merged.progress).sort()).toEqual([A, B].sort());
  });

  it("never un-solves: a stale copy can't undo a solve", () => {
    const plan = planSync(store({ [A]: solved() }), file(store({ [A]: solved({ completed: false }) })));
    expect(plan.merged.progress[A].completed).toBe(true);
    expect(plan.applyLocal).toBe(false);
  });

  it("keeps settings per device, and differing settings alone don't cause a round trip", () => {
    const local = store({ [A]: solved() }, { theme: "dark", apiKey: "mine" });
    const plan = planSync(local, file(store({ [A]: solved() }, { theme: "light" })));
    expect(plan).toMatchObject({ applyLocal: false, push: false });
    expect(plan.merged.settings.theme).toBe("dark");
    expect(plan.merged.settings.apiKey).toBe("mine");
  });

  it("the merge's tidying (trailing spaces, absent dates) isn't mistaken for news", () => {
    const messy = store({ [A]: solved({ approach: "two pointers  " }) });
    delete (messy.progress[A] as Partial<QuestionProgressV2>).gradedAt;
    const tidy = planSync(messy, null).merged; // what the first device uploaded is itself raw...
    const round1 = planSync(messy, file(tidy));
    const round2 = planSync(round1.merged, round1.upload);
    expect(round2).toMatchObject({ applyLocal: false, push: false }); // ...and it settles after one round
    expect(planSync(messy, file(round1.merged)).applyLocal).toBe(false);
  });

  it("re-keys a gist written before a problem moved pattern", () => {
    const old = "dp__1d-dp__decode-ways";
    const plan = planSync(store({}), file(store({ [old]: solved() })));
    expect(plan.merged.progress["dp__fibonacci-pattern__decode-ways"]?.completed).toBe(true);
    expect(plan.merged.progress[old]).toBeUndefined();
  });

  it("refuses to touch a gist file it can't read", () => {
    expect(() => planSync(store({}), "not json")).toThrow(expect.objectContaining({ code: "bad-file" }));
    expect(() => planSync(store({}), '{"hello":1}')).toThrow(expect.objectContaining({ code: "bad-file" }));
  });

  it("canonical ignores key order", () => {
    expect(canonical({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe(canonical({ a: { c: [3, { e: 0, f: 1 }], d: 2 }, b: 1 }));
  });
});
