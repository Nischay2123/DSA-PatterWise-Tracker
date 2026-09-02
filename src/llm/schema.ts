import type { EvaluationResult, FundamentalEvaluation, QuestionEvaluation } from "../types";

// The trust boundary for everything a model returns (plan §9&10). Nothing
// downstream may assume anything about the shape that isn't checked here.
//
// Hand-written rather than zod: the plan names zod, but this is one fixed
// schema behind one call site, and the project's own decisions (#1/#2) refuse
// a dependency wherever a few lines do the job -- there is no router, no
// state library, and no validation library. The behaviour the plan actually
// specifies (validate, clamp every number, strip unknown fields, never crash)
// is what's implemented and tested here; swapping in zod later is a
// self-contained change to this one file.
//
// Split on strictness, deliberately:
//   * anything that feeds the GRADE (ids, numeric scores) -> reject the whole
//     response if it's missing or the wrong type. Defaulting a missing score
//     to 0 would fabricate a failing grade, which the plan forbids outright.
//   * anything cosmetic (notes, feedback, focus lists) -> default to empty.
//     A missing note is not a reason to throw away a valid grading pass.

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// A usable score must be a real, finite number. Strings that look like
// numbers are rejected rather than coerced -- "wrong types" is a documented
// failure case, and silently coercing model output is how bad grades happen.
function scoreOrNull(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clamp(value, 0, max);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Models like to wrap JSON in prose or ```json fences even when told not to.
// Pull out the outermost {...} and parse that. Returns null for non-JSON and
// for truncated JSON -- both documented failure cases (§13).
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseFundamental(raw: unknown): FundamentalEvaluation | null {
  if (!isObject(raw)) return null;
  const conceptId = raw.conceptId;
  if (typeof conceptId !== "string" || !conceptId) return null;
  const score = scoreOrNull(raw.score, 5);
  if (score === null) return null;
  return { conceptId, score, missing: stringArray(raw.missing), note: stringOrEmpty(raw.note) };
}

function parseQuestion(raw: unknown): QuestionEvaluation | null {
  if (!isObject(raw)) return null;
  const questionId = raw.questionId;
  if (typeof questionId !== "string" || !questionId) return null;
  const correctness = scoreOrNull(raw.correctness, 5);
  const approach = scoreOrNull(raw.approach, 5);
  const pseudocode = scoreOrNull(raw.pseudocode, 5);
  const complexity = scoreOrNull(raw.complexity, 5);
  if (correctness === null || approach === null || pseudocode === null || complexity === null) return null;
  return {
    questionId,
    correctness,
    approach,
    pseudocode,
    complexity,
    mistakes: stringArray(raw.mistakes),
    note: stringOrEmpty(raw.note),
  };
}

// Returns null for anything that can't be trusted as a grade. Callers map
// that to INVALID_RESPONSE, which leaves the attempt PENDING and retryable --
// never auto-passed, never auto-failed.
export function parseEvaluation(raw: unknown): EvaluationResult | null {
  if (!isObject(raw)) return null;

  const perFundamentalRaw = raw.perFundamental;
  const perQuestionRaw = raw.perQuestion;
  if (!Array.isArray(perFundamentalRaw) || !Array.isArray(perQuestionRaw)) return null;

  const perFundamental: FundamentalEvaluation[] = [];
  for (const item of perFundamentalRaw) {
    const parsed = parseFundamental(item);
    if (!parsed) return null; // one unusable grade invalidates the set
    perFundamental.push(parsed);
  }

  const perQuestion: QuestionEvaluation[] = [];
  for (const item of perQuestionRaw) {
    const parsed = parseQuestion(item);
    if (!parsed) return null;
    perQuestion.push(parsed);
  }

  // The model's own verdict is recorded for display only -- scoring.ts
  // recomputes the real one. A missing/garbled `passed` therefore isn't worth
  // rejecting a whole response over.
  const score = scoreOrNull(raw.score, 100);

  // Only known keys are copied out, so injected extra fields are dropped.
  return {
    passed: raw.passed === true,
    score: score ?? 0,
    perFundamental,
    perQuestion,
    weakConcepts: stringArray(raw.weakConcepts),
    feedback: stringOrEmpty(raw.feedback),
    recommendedFocus: stringArray(raw.recommendedFocus),
  };
}
