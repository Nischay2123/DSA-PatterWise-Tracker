import { afterEach, describe, expect, it, vi } from "vitest";
import { canGradeSolutions, gateScore, gradeSolution } from "./gradeSolution";
import type { AppSettings } from "../types";

// The completion gate used to pass anything non-empty. These cover the two
// things that matter now: a wrong answer is rejected, and nothing about a
// flaky provider is allowed to look like a wrong answer.

const SETTINGS: AppSettings = {
  requireEvidence: true,
  gateOnRevisionDue: true,
  llmEnabled: false,
  theme: "system",
  provider: "gemini",
  model: "",
  apiKey: "key",
};

const ATTEMPT = {
  questionId: "two-sum",
  title: "Two Sum",
  patternName: "Hashing",
  difficulty: "Easy",
  topicName: "Arrays",
  approach: "One pass with a map from value to index.",
  pseudocode: "seen={}\nfor i,v in a: if t-v in seen: return [seen[t-v],i]; seen[v]=i",
  code: "def two_sum(a,t): ...",
};

function graded(scores: { correctness: number; approach: number; pseudocode: number; complexity: number }, extra = {}) {
  return JSON.stringify({
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                passed: true,
                score: 99, // the model's own total is ignored -- gateScore decides
                perFundamental: [],
                perQuestion: [{ questionId: "two-sum", mistakes: [], note: "", ...scores, ...extra }],
                weakConcepts: [],
                feedback: "",
                recommendedFocus: [],
              }),
            },
          ],
        },
      },
    ],
  });
}

function stubFetch(body: string | Error, status = 200) {
  const fn = vi.fn((_url: string, init: RequestInit) => {
    void init;
    return body instanceof Error ? Promise.reject(body) : Promise.resolve(new Response(body, { status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("gradeSolution", () => {
  it("passes a solution the model scores above the threshold", async () => {
    stubFetch(graded({ correctness: 4, approach: 4, pseudocode: 4, complexity: 4 }));
    expect(await gradeSolution(SETTINGS, ATTEMPT)).toEqual({ kind: "pass", score: 80, note: "" });
  });

  it("rejects the 'abc' case -- non-empty, but not a solution", async () => {
    stubFetch(
      graded({ correctness: 0, approach: 0, pseudocode: 0, complexity: 0 }, { mistakes: ["Not an attempt at the problem."], note: "This is not a solution." })
    );
    expect(await gradeSolution(SETTINGS, { ...ATTEMPT, pseudocode: "abc", code: "" })).toEqual({
      kind: "fail",
      score: 0,
      mistakes: ["Not an attempt at the problem."],
      note: "This is not a solution.",
    });
  });

  it("does not punish a correct solution for the complexity it was never asked for", async () => {
    // The panel collects approach/pseudocode/code only, so the complexity
    // block goes up blank and scores 0. Counting it would put a perfect
    // answer at 75 and a good one under the pass mark.
    stubFetch(graded({ correctness: 5, approach: 5, pseudocode: 5, complexity: 0 }));
    expect(await gradeSolution(SETTINGS, ATTEMPT)).toMatchObject({ kind: "pass", score: 100 });
  });

  it("sends the user's code, which a revision prompt never carries", async () => {
    const fetchFn = stubFetch(graded({ correctness: 4, approach: 4, pseudocode: 4, complexity: 4 }));
    await gradeSolution(SETTINGS, ATTEMPT);
    const sent = fetchFn.mock.calls[0]![1];
    const prompt = JSON.parse(sent.body as string).contents[0].parts[0].text;
    expect(prompt).toContain("USER CODE two-sum");
    expect(prompt).toContain("def two_sum(a,t): ...");
  });

  it("treats an unreachable provider as ungraded, never as a fail", async () => {
    stubFetch(new TypeError("offline"));
    expect(await gradeSolution(SETTINGS, ATTEMPT)).toEqual({ kind: "ungraded", error: "NETWORK" });
  });

  it("treats a response about some other question as ungraded", async () => {
    stubFetch(graded({ correctness: 5, approach: 5, pseudocode: 5, complexity: 5 }).replace("two-sum", "three-sum"));
    expect(await gradeSolution(SETTINGS, ATTEMPT)).toEqual({ kind: "ungraded", error: "INVALID_RESPONSE" });
  });

  it("grades only when there is a key to grade with", () => {
    expect(canGradeSolutions(SETTINGS)).toBe(true);
    expect(canGradeSolutions({ ...SETTINGS, apiKey: "   " })).toBe(false);
  });

  it("rounds the gate score off the sub-scores it asked for", () => {
    expect(gateScore({ correctness: 3, approach: 4, pseudocode: 4 }, { pseudocode: true })).toBe(73);
    expect(gateScore({ correctness: 3, approach: 4, pseudocode: 0 }, { pseudocode: false })).toBe(70);
  });

  it("does not mark down a code-only answer for the pseudocode it was told was optional", async () => {
    // The real 67: correctness 5, approach 5, and a pseudocode 0 for a box
    // the gate said could be left empty if code was given. (5+5+0)/3*20 = 67,
    // three points under the pass mark, for a correct solution.
    stubFetch(graded({ correctness: 5, approach: 5, pseudocode: 0, complexity: 0 }));
    expect(await gradeSolution(SETTINGS, { ...ATTEMPT, pseudocode: "" })).toMatchObject({ kind: "pass", score: 100 });
  });

  it("never sends a block the panel did not ask for", async () => {
    const fetchFn = stubFetch(graded({ correctness: 4, approach: 4, pseudocode: 4, complexity: 4 }));
    await gradeSolution(SETTINGS, { ...ATTEMPT, pseudocode: "" });
    const prompt = JSON.parse(fetchFn.mock.calls[0]![1].body as string).contents[0].parts[0].text;
    // An empty block is an unanswered question and scores 0. These were never
    // asked, so they must not appear at all.
    expect(prompt).not.toContain("USER PSEUDOCODE");
    expect(prompt).not.toContain("USER COMPLEXITY");
    expect(prompt).not.toContain("USER EDGE CASES");
    expect(prompt).toContain("USER CODE two-sum");
  });
});
