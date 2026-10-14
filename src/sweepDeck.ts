import type { NotebookEntry, NotebookTopic } from "./notebook";
import { getFundamentalsForPattern, type FundamentalConcept } from "./revision/session";
import { isSweepDue } from "./revision/sweepSchedule";
import type { QuestionProgressV2, SweepRating } from "./types";

// What the weekly sweep and the notebook's short views show, cut down from what
// you wrote. Three depths per problem -- the trick (a flashcard back), the
// compact card, the full notes -- and a one-row summary for the cheat sheet.

const sentences = (text: string) =>
  text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .filter(Boolean);

export function firstSentences(text: string, n: number): string {
  return sentences(text).slice(0, n).join(" ");
}

// "O(log n) time, because...; O(1) space" -> "O(log n) · O(1)". Falls back to the
// first sentence when no big-O is written.
export function costOf(complexity: string): string {
  const os = complexity.match(/O\((?:[^()]|\([^()]*\))*\)/g);
  return os ? [...new Set(os)].join(" · ") : firstSentences(complexity, 1);
}

export interface Trick {
  insight: string;
  reminder: string;
}

// The flashcard back: your key insight and reminder. A problem written up
// without them falls back to the start of its approach.
export function trickOf(p: QuestionProgressV2): Trick {
  const insight = p.notes.keyInsight.trim();
  const reminder = p.notes.reminder.trim();
  if (insight || reminder) return { insight, reminder };
  const fallback = p.notes.approach.trim() || p.approach.trim() || p.notes.legacy.trim();
  return { insight: firstSentences(fallback, 2), reminder: "" };
}

export const hasTrick = (p: QuestionProgressV2) => {
  const t = trickOf(p);
  return !!(t.insight || t.reminder);
};

/** A logged mistake as one line: what to remember, else what went wrong. */
const mistakeLines = (p: QuestionProgressV2) => p.mistakes.map((m) => (m.remember || m.what).trim()).filter(Boolean);

export interface Compact {
  insight: string;
  approach: string;
  traps: string[];
  cost: string;
  pseudocode: string;
}

// The middle depth: enough to rebuild the solution, none of the code.
export function compactOf(p: QuestionProgressV2): Compact {
  const insight = p.notes.keyInsight.trim() || p.notes.reminder.trim();
  const approach = firstSentences(p.notes.approach.trim() || p.approach.trim(), 2);
  const trap = firstSentences(p.notes.commonMistake, 1);
  return {
    insight,
    approach: approach === insight ? "" : approach,
    traps: [...new Set([trap, ...mistakeLines(p)].filter(Boolean))],
    cost: costOf(p.notes.complexity),
    pseudocode: p.pseudocode.trim(),
  };
}

export interface CheatRow {
  trick: string;
  trap: string;
  cost: string;
}

export function cheatRowOf(p: QuestionProgressV2): CheatRow {
  const t = trickOf(p);
  return {
    trick: firstSentences(t.insight || t.reminder, 1),
    trap: firstSentences(p.notes.commonMistake, 1) || mistakeLines(p)[0] || "",
    cost: costOf(p.notes.complexity),
  };
}

// --- Pattern card -------------------------------------------------------------

// The concepts that say when and why a pattern applies come first.
const TAG_ORDER = ["recognition", "applicability", "precondition", "non-applicability", "invariant", "technique"];
const tagRank = (c: FundamentalConcept) => {
  const ranks = c.tags.map((t) => TAG_ORDER.indexOf(t)).filter((i) => i >= 0);
  return ranks.length ? Math.min(...ranks) : TAG_ORDER.length;
};

export function patternConcepts(patternId: string, max = 4): FundamentalConcept[] {
  return getFundamentalsForPattern(patternId)
    .filter((c) => c.criticality === "core")
    .map((c, i) => ({ c, i }))
    .sort((a, b) => tagRank(a.c) - tagRank(b.c) || a.i - b.i)
    .slice(0, max)
    .map(({ c }) => c);
}

export interface Trap {
  problem: string;
  text: string;
}

// Your own traps across the pattern, each once.
export function patternTraps(entries: NotebookEntry[]): Trap[] {
  const seen = new Set<string>();
  const out: Trap[] = [];
  for (const { problem, progress } of entries) {
    for (const text of [firstSentences(progress.notes.commonMistake, 1), ...mistakeLines(progress)]) {
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      out.push({ problem: problem.question, text });
    }
  }
  return out;
}

// --- The deck -------------------------------------------------------------------

export interface DeckCard {
  entry: NotebookEntry;
  patternName: string;
  topicName: string;
}

export interface DeckPattern {
  id: string;
  name: string;
  topicId: string;
  topicName: string;
  /** Every solved problem with something to recall, sheet order. */
  cards: DeckCard[];
  /** The ones due this week: blanks first, then fuzzy, new, known. */
  due: DeckCard[];
  /** Solved, but nothing written to recall from. */
  unwritten: number;
}

export interface DeckTopic {
  id: string;
  name: string;
  patterns: DeckPattern[];
  cards: number;
  due: number;
  unwritten: number;
}

const DUE_ORDER: Record<SweepRating | "new", number> = { blank: 0, fuzzy: 1, new: 2, knew: 3 };

export function buildDeck(book: NotebookTopic[], today: string): DeckTopic[] {
  return book.map((t) => {
    const patterns = t.patterns.map((p) => {
      const withTrick = p.entries.filter((e) => hasTrick(e.progress));
      const cards = withTrick.map((entry) => ({ entry, patternName: p.name, topicName: t.name }));
      const due = cards
        .filter((c) => isSweepDue(c.entry.progress.sweep, today))
        .map((c, i) => ({ c, i, rank: DUE_ORDER[c.entry.progress.sweep?.rating ?? "new"] }))
        .sort((a, b) => a.rank - b.rank || a.i - b.i)
        .map(({ c }) => c);
      return { id: p.id, name: p.name, topicId: t.id, topicName: t.name, cards, due, unwritten: p.entries.length - withTrick.length };
    });
    const sum = (f: (p: DeckPattern) => number) => patterns.reduce((n, p) => n + f(p), 0);
    return {
      id: t.id,
      name: t.name,
      patterns,
      cards: sum((p) => p.cards.length),
      due: sum((p) => p.due.length),
      unwritten: sum((p) => p.unwritten),
    };
  });
}

// ~8s a card, ~45s a pattern card. Only patterns with something due are visited.
export function estimateMinutes(patterns: DeckPattern[]): number {
  const live = patterns.filter((p) => p.due.length);
  const seconds = live.reduce((n, p) => n + p.due.length * 8 + 45, 0);
  return Math.max(live.length ? 1 : 0, Math.round(seconds / 60));
}
