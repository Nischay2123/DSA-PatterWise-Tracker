// Phase 5: loads the Opus-authored fundamentals dataset and selects concepts
// for a revision session, spread across the topic's patterns. Read-only --
// never generates or rewrites data/fundamentals.json (plan §11).

import fundamentalsData from "../../data/fundamentals.json";
import questionsData from "../../data/questions.json";
import { REVISION_CONFIG } from "../config";
import type { QuestionData } from "../types";

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
