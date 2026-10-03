import { afterEach, describe, expect, it, vi } from "vitest";
import fundamentalsData from "../../data/fundamentals.json";
import questionsData from "../../data/questions.json";
import { findFundamentalsCoverageProblems } from "./session";
import type { FundamentalsFile } from "./session";
import type { QuestionData } from "../types";

// The plan's "a missing pattern must fail the build loudly" requirement lives
// here, in the test suite. session.ts itself only warns, because a throw at
// import time blanks the whole app in the browser.

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("../../data/fundamentals.json");
  vi.doUnmock("../../data/questions.json");
});

const ONE_TOPIC = {
  topics: [
    {
      id: "arrays",
      name: "Arrays",
      patterns: [
        { id: "arrays__a", name: "A", problems: [] },
        { id: "arrays__b", name: "B", problems: [] },
      ],
    },
  ],
} as unknown as QuestionData;

function concept(id: string) {
  return { id, prompt: "p", expectedConcepts: [], criticality: "core" as const, tags: [] };
}

describe("fundamentals coverage", () => {
  it("covers every pattern in the real questions.json, with unique concept ids", () => {
    const problems = findFundamentalsCoverageProblems(
      questionsData as QuestionData,
      fundamentalsData as FundamentalsFile
    );
    expect(problems.missing, "fundamentals.json is missing these pattern ids").toEqual([]);
    expect(problems.duplicates, "fundamentals.json has these duplicate concept ids").toEqual([]);
  });

  it("names a pattern that has no fundamentals entry", () => {
    const problems = findFundamentalsCoverageProblems(ONE_TOPIC, {
      version: 1,
      patterns: { arrays__a: { patternName: "A", topicId: "arrays", concepts: [concept("c1")] } },
    });
    expect(problems.missing).toEqual(["arrays__b"]);
  });

  it("names a concept id duplicated across patterns", () => {
    const problems = findFundamentalsCoverageProblems(ONE_TOPIC, {
      version: 1,
      patterns: {
        arrays__a: { patternName: "A", topicId: "arrays", concepts: [concept("dupe")] },
        arrays__b: { patternName: "B", topicId: "arrays", concepts: [concept("dupe")] },
      },
    });
    expect(problems.duplicates).toEqual(["dupe"]);
  });

  it("reports nothing when every pattern is covered and ids are unique, tolerating extra entries", () => {
    const problems = findFundamentalsCoverageProblems(ONE_TOPIC, {
      version: 1,
      patterns: {
        arrays__a: { patternName: "A", topicId: "arrays", concepts: [concept("c1")] },
        arrays__b: { patternName: "B", topicId: "arrays", concepts: [concept("c2")] },
        extra: { patternName: "X", topicId: "other", concepts: [concept("c3")] },
      },
    });
    expect(problems).toEqual({ missing: [], duplicates: [] });
  });
});

describe("a coverage gap does not stop the app from loading", () => {
  it("imports and only logs, so the UI still mounts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("../../data/questions.json", () => ({ default: ONE_TOPIC }));
    vi.doMock("../../data/fundamentals.json", () => ({
      default: {
        version: 1,
        patterns: {
          arrays__a: { patternName: "A", topicId: "arrays", concepts: [concept("dupe")] },
          extra: { patternName: "X", topicId: "other", concepts: [concept("dupe")] },
        },
      },
    }));

    const mod = await import("./session");
    expect(mod.getFundamentalsForPattern("arrays__a")).toHaveLength(1);
    expect(mod.getFundamentalsForPattern("arrays__b")).toEqual([]);
    expect(mod.selectFundamentalsForTopic("arrays", 1, 5)).toHaveLength(1);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/missing pattern id\(s\): arrays__b/));
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/duplicate concept id\(s\): dupe/));
  });
});
