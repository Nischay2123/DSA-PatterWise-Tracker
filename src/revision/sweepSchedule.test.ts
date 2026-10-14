import { describe, expect, it } from "vitest";
import { isSweepDue, mergeSweep, rateSweep } from "./sweepSchedule";

describe("sweep schedule", () => {
  it("a never-rated card is due", () => {
    expect(isSweepDue(undefined, "2026-10-14")).toBe(true);
  });

  it("knowing a card spaces it out weekly, then fortnightly, then monthly; anything else resets", () => {
    const one = rateSweep(undefined, "knew", "2026-10-04");
    expect(one.streak).toBe(1);
    expect(isSweepDue(one, "2026-10-09")).toBe(false);
    expect(isSweepDue(one, "2026-10-10")).toBe(true); // six days: a sweep a day early still sees it

    const two = rateSweep(one, "knew", "2026-10-11");
    expect(isSweepDue(two, "2026-10-17")).toBe(false);
    expect(isSweepDue(two, "2026-10-24")).toBe(true);

    const three = rateSweep(two, "knew", "2026-10-25");
    expect(isSweepDue(three, "2026-11-07")).toBe(false);
    expect(isSweepDue(three, "2026-11-21")).toBe(true);

    expect(rateSweep(three, "fuzzy", "2026-11-21").streak).toBe(0);
    expect(rateSweep(three, "blank", "2026-11-21").streak).toBe(0);
  });

  it("merging two devices keeps the later rating", () => {
    const a = rateSweep(undefined, "knew", "2026-10-04");
    const b = rateSweep(undefined, "blank", "2026-10-11");
    expect(mergeSweep(a, b)).toBe(b);
    expect(mergeSweep(b, a)).toBe(b);
    expect(mergeSweep(undefined, a)).toBe(a);
  });
});
