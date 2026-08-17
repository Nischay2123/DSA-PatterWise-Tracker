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
  masteryCycles: 3, // + 100% completion => MASTERED
  weakBoostFactor: 3,
  gracePeriodDays: 0,
  exemptTopics: ["fundamentals"], // never scheduled, never gated, omitted from every dashboard count
} as const;
