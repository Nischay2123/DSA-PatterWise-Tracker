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
