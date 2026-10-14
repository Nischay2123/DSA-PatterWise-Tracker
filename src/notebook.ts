import { goalScoped, isFullGoal, type Goal } from "./revision/goal";
import { getV2Progress, hasNotes } from "./store";
import type { AppStoreV2, Problem, QuestionProgressV2, Topic } from "./types";

// The notebook: what you wrote for each problem you've solved, arranged like the
// sheet -- topic, then pattern, then problems in sheet order. Read-only; it only
// re-arranges what the tracker already stores.

export interface NotebookEntry {
  problem: Problem;
  progress: QuestionProgressV2;
  /** Anything to read: a note, a solution field or a mistake. */
  written: boolean;
}

export interface NotebookPattern {
  id: string;
  name: string;
  entries: NotebookEntry[];
}

export interface NotebookTopic {
  id: string;
  name: string;
  patterns: NotebookPattern[];
  solved: number;
  written: number;
}

export function hasWriteUp(p: QuestionProgressV2): boolean {
  return (
    hasNotes(p) ||
    !!(p.approach.trim() || p.pseudocode.trim() || p.code.trim()) ||
    p.mistakes.length > 0
  );
}

// Solved problems in the chosen sheet only; a pattern or topic with none is left out.
export function buildNotebook(topics: Topic[], v2: AppStoreV2, goal: Goal): NotebookTopic[] {
  const out: NotebookTopic[] = [];
  for (const t of topics) {
    const patterns: NotebookPattern[] = [];
    for (const p of t.patterns) {
      const inSheet = isFullGoal(goal) ? p.problems : goalScoped(p.problems, goal);
      const entries = inSheet
        .map((problem) => ({ problem, progress: getV2Progress(v2, problem.id) }))
        .filter((e) => e.progress.completed)
        .map((e) => ({ ...e, written: hasWriteUp(e.progress) }));
      if (entries.length) patterns.push({ id: p.id, name: p.name, entries });
    }
    if (!patterns.length) continue;
    const all = patterns.flatMap((p) => p.entries);
    out.push({ id: t.id, name: t.name, patterns, solved: all.length, written: all.filter((e) => e.written).length });
  }
  return out;
}
