import { afterEach, describe, expect, it, vi } from "vitest";

// session.ts validates data/fundamentals.json at import time and throws
// loudly on a gap -- that's the plan's "a missing pattern must fail the build
// loudly" requirement. With the real (correct) dataset those throws can never
// fire, so the only way to prove the guard actually works is to import the
// module against a deliberately broken dataset.

afterEach(() => {
  vi.resetModules();
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
};

function concept(id: string) {
  return { id, prompt: "p", expectedConcepts: [], criticality: "core", tags: [] };
}

describe("fundamentals coverage is enforced at load time", () => {
  it("throws, naming the pattern, when a pattern has no fundamentals entry", async () => {
    vi.doMock("../../data/questions.json", () => ({ default: ONE_TOPIC }));
    vi.doMock("../../data/fundamentals.json", () => ({
      default: { version: 1, patterns: { arrays__a: { patternName: "A", topicId: "arrays", concepts: [concept("c1")] } } },
    }));

    await expect(import("./session")).rejects.toThrow(/missing pattern id\(s\): arrays__b/);
  });

  it("throws, naming the id, when a concept id is duplicated across patterns", async () => {
    vi.doMock("../../data/questions.json", () => ({ default: ONE_TOPIC }));
    vi.doMock("../../data/fundamentals.json", () => ({
      default: {
        version: 1,
        patterns: {
          arrays__a: { patternName: "A", topicId: "arrays", concepts: [concept("dupe")] },
          arrays__b: { patternName: "B", topicId: "arrays", concepts: [concept("dupe")] },
        },
      },
    }));

    await expect(import("./session")).rejects.toThrow(/duplicate concept id\(s\): dupe/);
  });

  it("imports cleanly when every pattern is covered and ids are unique", async () => {
    vi.doMock("../../data/questions.json", () => ({ default: ONE_TOPIC }));
    vi.doMock("../../data/fundamentals.json", () => ({
      default: {
        version: 1,
        patterns: {
          arrays__a: { patternName: "A", topicId: "arrays", concepts: [concept("c1")] },
          arrays__b: { patternName: "B", topicId: "arrays", concepts: [concept("c2")] },
        },
      },
    }));

    const mod = await import("./session");
    expect(mod.getFundamentalsForPattern("arrays__a")).toHaveLength(1);
    // An extra fundamentals entry with no matching pattern is tolerated --
    // only a MISSING one is a build-breaker.
    expect(mod.getFundamentalsForPattern("nope")).toEqual([]);
  });
});
