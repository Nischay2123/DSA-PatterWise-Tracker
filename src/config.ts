// Every tunable for the revision system in one place, referenced nowhere else
// as a literal (plan §5). Purely data -- the logic that reads these lives in
// src/revision/*.
export const REVISION_CONFIG = {
  completionThreshold: 0.75,
  intervalDays: [7, 14, 30, 60, 90], // index = cycle (post-pass); beyond the last index clamps to the last value
  passScore: 70,
  criticalConceptFloor: 2, // a `core` concept scoring below this fails the attempt regardless of overall total
  fundamentalsPerSession: 4,
  questionsPerSession: 3,
  // Manual revision: you can revise any topic whenever you like, provided
  // there is enough completed material to fill one session without asking
  // the same question twice. That is exactly questionsPerSession -- below
  // it a session gets padded with whatever exists, which is a worse first
  // experience than being told to solve one more problem first.
  manualRevisionMinCompleted: 3,
  masteryCycles: 3, // + 100% completion => MASTERED
  weakBoostFactor: 3,
  gracePeriodDays: 0,
  exemptTopics: ["fundamentals"], // never scheduled, never gated, omitted from every dashboard count
} as const;

// Source tags from puneetkhatri99/DSA_Tracker (Striver A2Z + NeetCode + Blind 75 + LeetCode lists)
export const SOURCES = {
  A2Z: "Striver A2Z",
  NC150: "NeetCode 150",
  NC250: "NeetCode 250",
  B75: "Blind 75",
  LC150: "LeetCode Top 150",
  LC75: "LeetCode 75",
} as const;

export type SourceKey = keyof typeof SOURCES;
