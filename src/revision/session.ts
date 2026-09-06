// Phase 5: loads the Opus-authored fundamentals dataset and selects concepts
// for a revision session, spread across the topic's patterns. Read-only --
// never generates or rewrites data/fundamentals.json (plan §11).

import fundamentalsData from "../../data/fundamentals.json";
import questionsData from "../../data/questions.json";
import { REVISION_CONFIG } from "../config";
import { selectQuestionsForSession } from "./selection";
import type { SelectionCandidate } from "./selection";
import type { AppStoreV2, QuestionData, RevisionAttempt } from "../types";

export interface FundamentalConcept {
  id: string;
  prompt: string;
  expectedConcepts: string[];
  criticality: "core" | "supporting";
  tags: string[];
}

interface FundamentalsPattern {
  patternName: string;
  topicId: string;
  concepts: FundamentalConcept[];
}

interface FundamentalsFile {
  version: number;
  patterns: Record<string, FundamentalsPattern>;
}

const FUNDAMENTALS = fundamentalsData as FundamentalsFile;
const QUESTIONS = questionsData as QuestionData;

// Fails loudly at import time (plan §Phase5 risk: "a missing pattern must
// fail the build loudly") rather than surfacing as a silent empty session
// later. Content correctness (not just presence) is Opus's job to fix --
// Sonnet reports the pattern id, never regenerates the file (plan §11).
function validateFundamentalsCoverage(): void {
  const patternIds = new Set<string>();
  for (const topic of QUESTIONS.topics) {
    for (const pattern of topic.patterns) patternIds.add(pattern.id);
  }

  const missing = [...patternIds].filter((id) => !(id in FUNDAMENTALS.patterns));
  if (missing.length > 0) {
    throw new Error(`fundamentals.json is missing pattern id(s): ${missing.join(", ")}`);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const pattern of Object.values(FUNDAMENTALS.patterns)) {
    for (const concept of pattern.concepts) {
      if (seen.has(concept.id)) duplicates.add(concept.id);
      seen.add(concept.id);
    }
  }
  if (duplicates.size > 0) {
    throw new Error(`fundamentals.json has duplicate concept id(s): ${[...duplicates].join(", ")}`);
  }
}

validateFundamentalsCoverage();

export function getFundamentalsForPattern(patternId: string): FundamentalConcept[] {
  return FUNDAMENTALS.patterns[patternId]?.concepts ?? [];
}

const CONCEPT_BY_ID: Record<string, FundamentalConcept> = {};
for (const pattern of Object.values(FUNDAMENTALS.patterns)) {
  for (const concept of pattern.concepts) CONCEPT_BY_ID[concept.id] = concept;
}

// A RevisionAttempt only stores conceptId + the user's answer (plan §11) --
// this is the read side, for rendering the prompt/expectedConcepts back
// during the session and in results.
export function getConceptById(conceptId: string): FundamentalConcept | null {
  return CONCEPT_BY_ID[conceptId] ?? null;
}

export function getPatternIdsForTopic(topicId: string): string[] {
  return QUESTIONS.topics.find((t) => t.id === topicId)?.patterns.map((p) => p.id) ?? [];
}

// Same small seeded PRNG as revision/selection.ts, kept local rather than
// imported -- Phase 4's files are frozen and this is five lines.
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Round-robin across the topic's patterns (one concept per pattern per
// round) so a session spreads out instead of clustering on whichever
// pattern happens to sort first -- same spread goal as selectQuestionsForSession,
// simplified since concepts carry no weighting inputs yet (that's Phase 8's
// weak-concept feedback loop, not this phase's job).
export function selectFundamentalsForTopic(
  topicId: string,
  seed: number,
  count: number = REVISION_CONFIG.fundamentalsPerSession
): FundamentalConcept[] {
  const patternOrder = seededShuffle(getPatternIdsForTopic(topicId), seed);
  const pools = patternOrder.map((pid, i) => seededShuffle(getFundamentalsForPattern(pid), seed + i + 1));

  const selected: FundamentalConcept[] = [];
  for (let round = 0; selected.length < count; round++) {
    const before = selected.length;
    for (const pool of pools) {
      if (selected.length >= count) break;
      if (pool[round]) selected.push(pool[round]);
    }
    if (selected.length === before) break; // every pool exhausted
  }
  return selected;
}

// --- Phase 6: assembling a real session ------------------------------------

// Days-since for selection weighting, using the same local-calendar
// convention as store.ts's heatmap dates -- revisionStats.lastRevisedAt is
// written with store.ts's todayISO(), not this file's UTC scheduler dates.
// dates.ts's own header explains why the scheduler's day math is
// deliberately UTC-only and separate; this mirrors that same split for the
// one new date field that lives on the *other* side of it.
function daysSinceLocal(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - then) / 86_400_000);
}

// Real SelectionCandidate[] for a topic, built from live progress -- every
// completed question in the topic is a candidate; an uncompleted one has
// nothing to recall yet and is excluded (selectQuestionsForSession already
// tolerates fewer candidates than requested).
export function buildSelectionCandidates(
  topicId: string,
  v2: AppStoreV2,
  questions: QuestionData,
  now: Date = new Date()
): SelectionCandidate[] {
  const topic = questions.topics.find((t) => t.id === topicId);
  if (!topic) return [];
  const weakConcepts = v2.revision[topicId]?.weakConcepts ?? {};

  const candidates: SelectionCandidate[] = [];
  for (const pattern of topic.patterns) {
    for (const problem of pattern.problems) {
      const progress = v2.progress[problem.id];
      if (!progress?.completed) continue;
      candidates.push({
        id: problem.id,
        patternId: pattern.id,
        difficulty: problem.difficulty,
        isWeak: !!weakConcepts[problem.id],
        lastConfidence: progress.revisionStats.lastConfidence,
        lastRevisionScore: progress.revisionStats.lastScore,
        mistakesCount: progress.mistakes.length,
        daysSinceLastRevised: daysSinceLocal(progress.revisionStats.lastRevisedAt, now),
      });
    }
  }
  return candidates;
}

// activeSessionId only tracks an in-progress draft -- it's cleared the
// moment SUBMIT_REVISION_SESSION runs (plan §6: submitting concludes the
// session). Finding "what to show for this topic" has to fall back to the
// most recently started attempt regardless of submitted status, or a
// freshly-submitted (still unevaluated, PENDING) attempt would never be
// shown back to the user -- SessionShell would just start another one on
// top of it every time.
export function mostRecentAttemptForTopic(v2: AppStoreV2, topicId: string): RevisionAttempt | null {
  let latest: RevisionAttempt | null = null;
  for (const attempt of Object.values(v2.attempts)) {
    if (attempt.topicId !== topicId) continue;
    // >= , not >: two attempts can share the same millisecond startedAt (a
    // StrictMode double-dispatch is the known real-world case -- see
    // SessionShell's guard against it). On an exact tie this must prefer
    // the later one in iteration/insertion order, since that's the one that
    // ended up as the real activeSessionId and could since have been
    // submitted -- picking the earlier one risks permanently resurfacing a
    // stale, orphaned, never-submitted duplicate instead.
    if (!latest || attempt.startedAt >= latest.startedAt) latest = attempt;
  }
  return latest;
}

// Assembles a complete draft attempt in one shot -- fundamentals and
// questions are selected exactly once, here, and persisted verbatim via
// START_REVISION_SESSION. Nothing re-runs selection on a later render,
// which is what lets a refreshed/resumed session show the same items
// instead of a fresh random draw each time.
export function createRevisionAttempt(
  id: string,
  topicId: string,
  v2: AppStoreV2,
  questions: QuestionData,
  now: Date = new Date()
): RevisionAttempt {
  const seed = now.getTime();
  const fundamentals = selectFundamentalsForTopic(topicId, seed, REVISION_CONFIG.fundamentalsPerSession).map((c) => ({
    conceptId: c.id,
    answer: "",
  }));

  const candidates = buildSelectionCandidates(topicId, v2, questions, now);
  const selected = selectQuestionsForSession(candidates, REVISION_CONFIG.questionsPerSession, seed + 1);

  return {
    id,
    topicId,
    startedAt: now.toISOString(),
    submittedAt: null,
    fundamentals,
    questions: selected.map((c) => ({
      questionId: c.id,
      approach: "",
      pseudocode: "",
      complexity: "",
      edgeCases: "",
      confidence: null,
    })),
    evaluationStatus: "DRAFT",
    evaluation: null,
    error: null,
  };
}
