import { describe, expect, it } from "vitest";
import { extractJson, parseEvaluation } from "./schema";

// The plan's §13 "LLM boundary" suite: valid response · missing field ·
// wrong types · out-of-range numbers clamp · non-JSON body · truncated JSON ·
// injected extra fields stripped. All must be handled safely, none may crash.

function validRaw() {
  return {
    passed: true,
    score: 82,
    perFundamental: [{ conceptId: "c1", score: 4, missing: ["edge cases"], note: "solid" }],
    perQuestion: [
      { questionId: "q1", correctness: 5, approach: 4, pseudocode: 4, complexity: 3, mistakes: [], note: "good" },
    ],
    weakConcepts: ["c9"],
    feedback: "nice work",
    recommendedFocus: ["binary search"],
  };
}

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("pulls JSON out of a ```json fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("pulls JSON out of surrounding prose", () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it("returns null for a non-JSON body", () => {
    expect(extractJson("I'm sorry, I can't help with that.")).toBeNull();
  });

  it("returns null for truncated JSON", () => {
    expect(extractJson('{"perFundamental": [{"conceptId": "c1", "sco')).toBeNull();
  });

  it("returns null for an empty body", () => {
    expect(extractJson("")).toBeNull();
  });
});

describe("parseEvaluation -- happy path", () => {
  it("accepts a well-formed response unchanged", () => {
    expect(parseEvaluation(validRaw())).toEqual(validRaw());
  });

  it("strips injected extra fields", () => {
    const raw = { ...validRaw(), __proto__hack: "x", extra: { nested: true }, apiKey: "leaked" };
    const parsed = parseEvaluation(raw)!;
    expect(parsed).toEqual(validRaw());
    expect(Object.keys(parsed)).not.toContain("extra");
    expect(Object.keys(parsed)).not.toContain("apiKey");
  });

  it("strips extra fields inside per-item entries too", () => {
    const raw = validRaw();
    (raw.perQuestion[0] as Record<string, unknown>).injected = "nope";
    const parsed = parseEvaluation(raw)!;
    expect(Object.keys(parsed.perQuestion[0])).not.toContain("injected");
  });
});

describe("parseEvaluation -- clamping", () => {
  it("clamps out-of-range concept scores into 0-5", () => {
    const raw = validRaw();
    raw.perFundamental[0].score = 99;
    expect(parseEvaluation(raw)!.perFundamental[0].score).toBe(5);
  });

  it("clamps negative scores up to 0", () => {
    const raw = validRaw();
    raw.perQuestion[0].correctness = -7;
    expect(parseEvaluation(raw)!.perQuestion[0].correctness).toBe(0);
  });

  it("clamps the overall score into 0-100", () => {
    const raw = validRaw();
    raw.score = 5000;
    expect(parseEvaluation(raw)!.score).toBe(100);
  });
});

describe("parseEvaluation -- rejects anything that could corrupt a grade", () => {
  it("rejects a non-object", () => {
    expect(parseEvaluation("nope")).toBeNull();
    expect(parseEvaluation(null)).toBeNull();
    expect(parseEvaluation([])).toBeNull();
  });

  it("rejects a missing perQuestion array", () => {
    const raw = validRaw() as Record<string, unknown>;
    delete raw.perQuestion;
    expect(parseEvaluation(raw)).toBeNull();
  });

  it("rejects a missing numeric score rather than defaulting it to zero", () => {
    const raw = validRaw() as { perFundamental: Record<string, unknown>[] };
    delete raw.perFundamental[0].score;
    expect(parseEvaluation(raw)).toBeNull();
  });

  it("rejects a stringified number rather than coercing it", () => {
    const raw = validRaw() as unknown as { perQuestion: Record<string, unknown>[] };
    raw.perQuestion[0].approach = "4";
    expect(parseEvaluation(raw)).toBeNull();
  });

  it("rejects NaN and Infinity", () => {
    const a = validRaw();
    a.perFundamental[0].score = NaN;
    expect(parseEvaluation(a)).toBeNull();
    const b = validRaw();
    b.perQuestion[0].complexity = Infinity;
    expect(parseEvaluation(b)).toBeNull();
  });

  it("rejects an entry with no id", () => {
    const raw = validRaw() as unknown as { perFundamental: Record<string, unknown>[] };
    raw.perFundamental[0].conceptId = "";
    expect(parseEvaluation(raw)).toBeNull();
  });

  it("rejects a non-object inside a per-item array", () => {
    const raw = validRaw() as unknown as { perQuestion: unknown[] };
    raw.perQuestion[0] = "nope";
    expect(parseEvaluation(raw)).toBeNull();
  });
});

describe("parseEvaluation -- tolerates cosmetic gaps", () => {
  it("defaults missing notes/arrays instead of throwing the grade away", () => {
    const parsed = parseEvaluation({
      perFundamental: [{ conceptId: "c1", score: 3 }],
      perQuestion: [{ questionId: "q1", correctness: 3, approach: 3, pseudocode: 3, complexity: 3 }],
    })!;
    expect(parsed).not.toBeNull();
    expect(parsed.perFundamental[0].missing).toEqual([]);
    expect(parsed.perFundamental[0].note).toBe("");
    expect(parsed.feedback).toBe("");
    expect(parsed.recommendedFocus).toEqual([]);
  });

  it("treats a missing/garbled `passed` as false without rejecting -- it's advisory anyway", () => {
    const raw = validRaw() as Record<string, unknown>;
    raw.passed = "yes please";
    expect(parseEvaluation(raw)!.passed).toBe(false);
  });

  it("drops non-string entries from string arrays", () => {
    const raw = validRaw() as unknown as { weakConcepts: unknown[] };
    raw.weakConcepts = ["c1", 42, null, "c2"];
    expect(parseEvaluation(raw)!.weakConcepts).toEqual(["c1", "c2"]);
  });
});
