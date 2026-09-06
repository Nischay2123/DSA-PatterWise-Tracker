export interface Problem {
  id: string;
  subpattern: string;
  question: string;
  platform: string;
  link: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  originalStep: string;
  estMinutes: string;
  importance: string;
  interviewFreq: string;
}

export interface Pattern {
  id: string;
  name: string;
  problems: Problem[];
}

export interface Topic {
  id: string;
  name: string;
  patterns: Pattern[];
}

export interface QuestionData {
  topics: Topic[];
}

export interface ProblemState {
  done: boolean;
  revise: boolean;
  notes: string;
  completedAt: string | null;
  revisedAt: string | null;
}

export interface ProgressStore {
  version: number;
  problems: Record<string, ProblemState>;
  idsMigrated?: boolean;
}

export interface FilterState {
  search: string;
  difficulty: "All" | "Easy" | "Medium" | "Hard";
  importance: string;
  freq: string;
  hideCompleted: boolean;
  reviseOnly: boolean;
  // Show only the problems the active revision goal counts. Optional so a
  // FilterState built before this existed still type-checks as one.
  goalOnly?: boolean;
}

export interface HeatmapDay {
  date: Date;
  done: number;
  revised: number;
}

export interface HeatmapMonth {
  label: string;
  pad: number;
  days: HeatmapDay[];
}

// --- v2 schema (Phase 2: IndexedDB) -----------------------------------------

export interface QuestionProgressV2 {
  completed: boolean;
  starred: boolean;
  starredAt: string | null; // v1 `revisedAt` -- a bookmark date, NOT a revision date
  firstCompletedAt: string | null;
  lastCompletedAt: string | null;
  // null = grandfathered / no completion-evidence gate applied (migrated from v1,
  // or completed before Phase 3's gate exists). Once Phase 3 ships a real gate,
  // a positive integer records which gate version's evidence rule was satisfied.
  completionGateVersion: number | null;
  approach: string;
  pseudocode: string;
  code: string;
  notes: {
    legacy: string;
    approach: string;
    keyInsight: string;
    commonMistake: string;
    complexity: string;
    edgeCases: string;
    reminder: string;
  };
  mistakes: { at: string; what: string; remember: string }[];
  revisionStats: {
    count: number;
    lastRevisedAt: string | null; // real revisions only, never fabricated from starredAt
    lastScore: number | null;
    lastConfidence: "strong" | "partial" | "forgot" | null;
  };
}

export interface TopicRevision {
  topicId: string;
  cycle: number;
  nextDueAt: string | null;
  lastPassedAt: string | null;
  lastFailedAt: string | null;
  activeSessionId: string | null;
  // score is null for a self-assessed revision: the user confirmed they did
  // it, but nothing graded it, and inventing a number would be a lie.
  history: { at: string; score: number | null; passed: boolean; attemptId: string; selfAssessed?: boolean }[];
  weakConcepts: Record<string, number>;
}

// The evaluator's response contract (plan §9&10). `passed` and `score` here
// are the MODEL's own opinion -- advisory only, never authoritative. The real
// pass/fail is always recomputed client-side by revision/scoring.ts.
export interface FundamentalEvaluation {
  conceptId: string;
  score: number; // 0-5
  missing: string[];
  note: string;
}

export interface QuestionEvaluation {
  questionId: string;
  correctness: number; // 0-5
  approach: number;
  pseudocode: number;
  complexity: number;
  mistakes: string[];
  note: string;
}

export interface EvaluationResult {
  passed: boolean;
  score: number; // 0-100
  perFundamental: FundamentalEvaluation[];
  perQuestion: QuestionEvaluation[];
  weakConcepts: string[];
  feedback: string;
  recommendedFocus: string[];
}

export interface RevisionAttempt {
  id: string;
  topicId: string;
  startedAt: string;
  submittedAt: string | null;
  fundamentals: { conceptId: string; answer: string }[];
  questions: {
    questionId: string;
    approach: string;
    pseudocode: string;
    complexity: string;
    edgeCases: string;
    // null = not yet rated (draft, mirrors SelectionCandidate.lastConfidence's
    // existing null-means-unset idiom) -- distinct from a real self-rating.
    confidence: "strong" | "partial" | "forgot" | null;
  }[];
  // DRAFT = unsubmitted. PENDING = submitted, not yet successfully evaluated
  // (this is also where every evaluation FAILURE rests, per §9: failures are
  // always retryable, never terminal). OK = evaluated. FAILED_PERMANENT is
  // part of the plan's schema but is deliberately never written -- see
  // PHASE_7_REPORT.md §3.
  evaluationStatus: "DRAFT" | "PENDING" | "OK" | "FAILED_PERMANENT";
  evaluation: EvaluationResult | null;
  error: string | null;
}

export interface AppSettings {
  requireEvidence: boolean;
  // Whether a due revision blocks NEW completions in that topic. Optional
  // so stores written before this existed keep the original behaviour;
  // absent is read as true.
  gateOnRevisionDue?: boolean;
  llmEnabled: boolean;
  // Narrows the scope revision schedules against (src/revision/goal.ts).
  // Optional so stores written before this existed keep the original
  // full-syllabus behaviour; absent is read as DEFAULT_GOAL.
  goal?: { minFreq: string; difficulties: string[]; listId?: string };
  theme: string;
  provider: "gemini" | "grok";
  model: string;
  apiKey: string;
}

export interface AppStoreV2 {
  schemaVersion: 2;
  progress: Record<string, QuestionProgressV2>;
  revision: Record<string, TopicRevision>;
  attempts: Record<string, RevisionAttempt>;
  settings: AppSettings;
  // Unknown ids from v1 that couldn't be mapped through idMap.json -- never dropped.
  orphanedProgress: Record<string, QuestionProgressV2>;
}

// --- v2-native writes (Phase 2 remediation) ---------------------------------
// The v1 reducer/adapter in context.ts + store.ts can only carry fields that
// exist on the v1 ProblemState shape. These fields have no v1 equivalent, so
// they need their own write path that the v1 adapter never touches.

export type StructuredNoteField =
  | "approach"
  | "keyInsight"
  | "commonMistake"
  | "complexity"
  | "edgeCases"
  | "reminder";

export type V2Action =
  | { type: "SET_APPROACH"; id: string; approach: string }
  | { type: "SET_PSEUDOCODE"; id: string; pseudocode: string }
  | { type: "SET_CODE"; id: string; code: string }
  | { type: "SET_STRUCTURED_NOTE"; id: string; field: StructuredNoteField; value: string }
  | { type: "ADD_MISTAKE"; id: string; mistake: { at: string; what: string; remember: string } }
  | { type: "REMOVE_MISTAKE"; id: string; at: string }
  // Wholesale replace, for importing/restoring a complete v2 export or backup --
  // mirrors the v1 reducer's own "IMPORT" case.
  | { type: "REPLACE_STORE"; store: AppStoreV2 }
  // --- Phase 6: revision session lifecycle -----------------------------
  // Attempt is built once (fundamentals/questions already selected) by
  // revision/session.ts's createRevisionAttempt and handed in whole --
  // selection must not re-run on every render/refresh, or a resumed
  // session would show different questions than the one the user started.
  | { type: "START_REVISION_SESSION"; topicId: string; attempt: RevisionAttempt }
  | { type: "SAVE_FUNDAMENTAL_ANSWER"; attemptId: string; conceptId: string; answer: string }
  | {
      type: "SAVE_QUESTION_RECALL";
      attemptId: string;
      questionId: string;
      field: "approach" | "pseudocode" | "complexity" | "edgeCases";
      value: string;
    }
  | {
      type: "SAVE_QUESTION_CONFIDENCE";
      attemptId: string;
      questionId: string;
      confidence: "strong" | "partial" | "forgot";
    }
  | { type: "SUBMIT_REVISION_SESSION"; attemptId: string }
  // --- Phase 7: LLM evaluation -----------------------------------------
  | { type: "SET_SETTINGS"; patch: Partial<AppSettings> }
  // Records a failed evaluation. Status stays PENDING on purpose -- every
  // failure is retryable, none is terminal (plan §9).
  | { type: "SET_ATTEMPT_ERROR"; attemptId: string; error: string | null }
  | { type: "APPLY_EVALUATION"; attemptId: string; evaluation: EvaluationResult }
  // The escape hatch: the user states they completed this revision. Records
  // a pass with NO score, so the schedule advances without fabricating a grade.
  | { type: "MARK_REVISION_SELF_ASSESSED"; attemptId: string };
