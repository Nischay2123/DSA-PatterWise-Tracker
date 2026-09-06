import { REVISION_CONFIG } from "../config";

export interface SelectionCandidate {
  id: string;
  patternId: string;
  difficulty: "Easy" | "Medium" | "Hard";
  isWeak: boolean;
  lastConfidence: "strong" | "partial" | "forgot" | null;
  lastRevisionScore: number | null;
  mistakesCount: number;
  // null means never revised -- distinct from 0, which would understate how stale it is.
  daysSinceLastRevised: number | null;
}

// The exact weighting formula from plan §8. Confidence/score/staleness terms
// default to neutral (1, or 0 days) when there's no prior revision to read --
// `neverRevised` is what carries that boost instead, so the two don't double
// up on a question that's simply never been touched.
export function computeQuestionWeight(candidate: SelectionCandidate): number {
  const neverRevised = candidate.daysSinceLastRevised === null;
  let weight = 1;
  weight *= candidate.isWeak ? REVISION_CONFIG.weakBoostFactor : 1;
  weight *= candidate.lastConfidence === "forgot" ? 3 : candidate.lastConfidence === "partial" ? 1.75 : 1;
  weight *= candidate.lastRevisionScore !== null && candidate.lastRevisionScore < REVISION_CONFIG.passScore ? 2 : 1;
  weight *= candidate.mistakesCount > 0 ? 1.5 : 1;
  weight *= candidate.difficulty === "Hard" ? 1.4 : candidate.difficulty === "Medium" ? 1.15 : 1;
  weight *= 1 + (candidate.daysSinceLastRevised ?? 0) / 30;
  weight *= neverRevised ? 1.5 : 1;
  return weight;
}

// mulberry32 -- a small, fast, deterministic PRNG. Not for anything
// security-sensitive; just needs to be seeded and reproducible for tests
// ("1000 seeded runs" in the plan's test list) and for resuming a session
// deterministically.
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

// Weighted selection without replacement. Prefers a candidate from a
// pattern not yet represented in this session (falling back to the full
// remaining pool once every pattern has contributed at least one), so a
// session spreads across the topic's patterns instead of clustering.
export function selectQuestionsForSession(
  candidates: SelectionCandidate[],
  count: number,
  seed: number
): SelectionCandidate[] {
  if (candidates.length <= count) {
    return seededShuffle(candidates, seed);
  }

  const rng = mulberry32(seed);
  const pool = [...candidates];
  const usedPatterns = new Set<string>();
  const selected: SelectionCandidate[] = [];

  while (selected.length < count && pool.length > 0) {
    const unusedPatternPool = pool.filter((c) => !usedPatterns.has(c.patternId));
    const activePool = unusedPatternPool.length > 0 ? unusedPatternPool : pool;

    const weights = activePool.map(computeQuestionWeight);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * totalWeight;
    let pickIndex = activePool.length - 1;
    for (let i = 0; i < activePool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pickIndex = i;
        break;
      }
    }

    const picked = activePool[pickIndex];
    selected.push(picked);
    usedPatterns.add(picked.patternId);
    pool.splice(pool.indexOf(picked), 1);
  }

  return selected;
}
