import { describe, expect, it } from "vitest";
import { addDaysUTC, daysBetweenUTC, todayISOUTC } from "./dates";

describe("addDaysUTC", () => {
  it("adds whole days within a month", () => {
    expect(addDaysUTC("2026-01-01", 7)).toBe("2026-01-08");
  });

  it("rolls over a month boundary", () => {
    expect(addDaysUTC("2026-01-28", 7)).toBe("2026-02-04");
  });

  it("rolls over a year boundary", () => {
    expect(addDaysUTC("2025-12-28", 7)).toBe("2026-01-04");
  });

  it("is exact across a US DST spring-forward boundary (2026-03-08)", () => {
    // A local-time-based implementation could drift by an hour/day here
    // depending on the runtime's TZ; UTC millisecond math cannot.
    expect(addDaysUTC("2026-03-01", 14)).toBe("2026-03-15");
  });

  it("is exact across a US DST fall-back boundary (2026-11-01)", () => {
    expect(addDaysUTC("2026-10-25", 14)).toBe("2026-11-08");
  });

  it("handles zero and negative day deltas", () => {
    expect(addDaysUTC("2026-06-15", 0)).toBe("2026-06-15");
    expect(addDaysUTC("2026-06-15", -5)).toBe("2026-06-10");
  });
});

describe("daysBetweenUTC", () => {
  it("counts whole days forward", () => {
    expect(daysBetweenUTC("2026-01-01", "2026-01-08")).toBe(7);
  });

  it("counts whole days backward as negative", () => {
    expect(daysBetweenUTC("2026-01-08", "2026-01-01")).toBe(-7);
  });

  it("is zero for the same date", () => {
    expect(daysBetweenUTC("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("is exact across a DST boundary", () => {
    expect(daysBetweenUTC("2026-03-01", "2026-03-15")).toBe(14);
  });
});

describe("todayISOUTC", () => {
  it("returns the UTC calendar date, not the local one", () => {
    // 2026-01-01T23:30:00 local-naive input, but constructed via a UTC
    // instant so this is unambiguous regardless of the test runner's TZ.
    const now = new Date(Date.UTC(2026, 0, 1, 23, 30));
    expect(todayISOUTC(now)).toBe("2026-01-01");
  });

  it("rolls to the next UTC day past midnight UTC", () => {
    const now = new Date(Date.UTC(2026, 0, 2, 0, 0));
    expect(todayISOUTC(now)).toBe("2026-01-02");
  });
});
