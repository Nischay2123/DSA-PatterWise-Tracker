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
  history: { at: string; score: number; passed: boolean; attemptId: string }[];
  weakConcepts: Record<string, number>;
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
    confidence: "strong" | "partial" | "forgot";
  }[];
  evaluationStatus: "DRAFT" | "PENDING" | "OK" | "FAILED_PERMANENT";
  evaluation: Record<string, unknown> | null;
  error: string | null;
}

export interface AppSettings {
  requireEvidence: boolean;
  llmEnabled: boolean;
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
  | { type: "REMOVE_MISTAKE"; id: string; at: string };
