import { describe, expect, it } from "vitest";
import questionsData from "../../data/questions.json";
import { buildPromptInput, scoreEvaluation } from "./evaluate";
import { getFundamentalsForPattern } from "./session";
import type { EvaluationResult, QuestionData, RevisionAttempt, Topic } from "../types";

const QUESTIONS = questionsData as QuestionData;
const ARRAYS = QUESTIONS.topics.find((t) => t.id === "arrays") as Topic;
const ARRAYS_PROBLEM = ARRAYS.patterns[0].problems[0];

// Real concepts, so criticality lookups exercise the real dataset.
const SLIDING = getFundamentalsForPattern("arrays__sliding-window");
const CORE_CONCEPT = SLIDING.find((c) => c.criticality === "core")!;

function attempt(patch: Partial<RevisionAttempt> = {}): RevisionAttempt {
  return {
    id: "att1",
    topicId: "arrays",
    startedAt: "2026-01-01T00:00:00.000Z",
    submittedAt: "2026-01-01T00:30:00.000Z",
    fundamentals: [{ conceptId: CORE_CONCEPT.id, answer: "my recall" }],
    questions: [
      { questionId: ARRAYS_PROBLEM.id, approach: "a", pseudocode: "p", complexity: "O(n)", edgeCases: "", confidence: "partial" },
    ],
    evaluationStatus: "PENDING",
    evaluation: null,
    error: null,
    ...patch,
  };
}

function evaluation(patch: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    passed: true,
    score: 90,
    perFundamental: [{ conceptId: CORE_CONCEPT.id, score: 5, missing: [], note: "" }],
    perQuestion: [
      { questionId: ARRAYS_PROBLEM.id, correctness: 5, approach: 5, pseudocode: 5, complexity: 5, mistakes: [], note: "" },
    ],
    weakConcepts: [],
    feedback: "",
    recommendedFocus: [],
    ...patch,
  };
}

describe("buildPromptInput", () => {
  it("resolves real concept prompts and expectedConcepts from the dataset", () => {
    const input = buildPromptInput(attempt(), ARRAYS);
    expect(input.fundamentals[0].prompt).toBe(CORE_CONCEPT.prompt);
    expect(input.fundamentals[0].expectedConcepts).toEqual(CORE_CONCEPT.expectedConcepts);
    expect(input.fundamentals[0].answer).toBe("my recall");
  });

  it("resolves real problem metadata", () => {
    const input = buildPromptInput(attempt(), ARRAYS);
    expect(input.questions[0].title).toBe(ARRAYS_PROBLEM.question);
    expect(input.questions[0].difficulty).toBe(ARRAYS_PROBLEM.difficulty);
    expect(input.questions[0].patternName).toBe(ARRAYS.patterns[0].name);
  });

  it("carries no field for the stored solution, so it can never be sent", () => {
    const input = buildPromptInput(attempt(), ARRAYS);
    const keys = Object.keys(input.questions[0]);
    expect(keys).toEqual(["questionId", "title", "patternName", "difficulty", "approach", "pseudocode", "complexity", "edgeCases"]);
  });

  it("degrades gracefully for an id absent from the dataset", () => {
    const input = buildPromptInput(attempt({ fundamentals: [{ conceptId: "ghost", answer: "x" }] }), ARRAYS);
    expect(input.fundamentals[0].prompt).toBe("ghost");
    expect(input.fundamentals[0].expectedConcepts).toEqual([]);
  });
});

describe("scoreEvaluation -- the grade is computed client-side", () => {
  it("ignores the model's own passed/score and recomputes both", () => {
    // Model claims a confident pass while handing back all-zero scores.
    const lying = evaluation({
      passed: true,
      score: 100,
      perFundamental: [{ conceptId: CORE_CONCEPT.id, score: 0, missing: [], note: "" }],
      perQuestion: [
        { questionId: ARRAYS_PROBLEM.id, correctness: 0, approach: 0, pseudocode: 0, complexity: 0, mistakes: [], note: "" },
      ],
    });
    const scored = scoreEvaluation(attempt(), lying)!;
    expect(scored.scoring.passed).toBe(false);
    expect(scored.scoring.overallScore).toBe(0);
  });

  it("passes a genuinely strong attempt", () => {
    const scored = scoreEvaluation(attempt(), evaluation())!;
    expect(scored.scoring.passed).toBe(true);
    expect(scored.scoring.overallScore).toBe(100);
  });

  it("applies the critical-concept floor using the real concept's criticality", () => {
    const weakCore = evaluation({
      perFundamental: [{ conceptId: CORE_CONCEPT.id, score: 1, missing: [], note: "" }],
    });
    const scored = scoreEvaluation(attempt(), weakCore)!;
    expect(scored.scoring.passed).toBe(false);
    expect(scored.scoring.weakConceptIds).toContain(CORE_CONCEPT.id);
  });

  it("scales each question to 0-100 for revisionStats.lastScore", () => {
    const scored = scoreEvaluation(attempt(), evaluation())!;
    expect(scored.questionScores[ARRAYS_PROBLEM.id]).toBe(100);

    const mixed = evaluation({
      perQuestion: [
        { questionId: ARRAYS_PROBLEM.id, correctness: 4, approach: 3, pseudocode: 2, complexity: 3, mistakes: [], note: "" },
      ],
    });
    // avg 3 -> 60
    expect(scoreEvaluation(attempt(), mixed)!.questionScores[ARRAYS_PROBLEM.id]).toBe(60);
  });
});

describe("scoreEvaluation -- never fabricates a grade", () => {
  it("returns null when the model skipped a fundamental, rather than scoring it zero", () => {
    const incomplete = evaluation({ perFundamental: [] });
    expect(scoreEvaluation(attempt(), incomplete)).toBeNull();
  });

  it("returns null when the model skipped a question", () => {
    const incomplete = evaluation({ perQuestion: [] });
    expect(scoreEvaluation(attempt(), incomplete)).toBeNull();
  });

  it("ignores hallucinated ids that match nothing in the attempt", () => {
    const withGhost = evaluation({
      perFundamental: [
        { conceptId: CORE_CONCEPT.id, score: 5, missing: [], note: "" },
        { conceptId: "totally-made-up", score: 0, missing: [], note: "" },
      ],
    });
    const scored = scoreEvaluation(attempt(), withGhost)!;
    expect(scored.scoring.passed).toBe(true); // the invented 0 didn't drag it down
    expect(scored.scoring.weakConceptIds).not.toContain("totally-made-up");
  });

  it("treats an unknown concept as supporting so it can't trip the critical floor", () => {
    const ghostAttempt = attempt({ fundamentals: [{ conceptId: "ghost", answer: "x" }] });
    const ghostEval = evaluation({ perFundamental: [{ conceptId: "ghost", score: 0, missing: [], note: "" }] });
    const scored = scoreEvaluation(ghostAttempt, ghostEval)!;
    expect(scored.scoring.criticalFloorFailed).toBe(false);
  });
});
