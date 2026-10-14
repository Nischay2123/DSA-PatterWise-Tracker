import { describe, expect, it } from "vitest";
import { buildDeck, cheatRowOf, compactOf, costOf, estimateMinutes, firstSentences, patternConcepts, patternTraps, trickOf } from "./sweepDeck";
import type { NotebookTopic } from "./notebook";
import { liftV1Entry } from "./persistence/migrate";
import type { Problem, QuestionProgressV2 } from "./types";

const solved = (notes: Partial<QuestionProgressV2["notes"]> = {}, patch: Partial<QuestionProgressV2> = {}): QuestionProgressV2 => {
  const base = liftV1Entry({ done: true, revise: false, notes: "", completedAt: "2026-08-01", revisedAt: null });
  return { ...base, ...patch, notes: { ...base.notes, ...notes } };
};
const problem = (id: string): Problem => ({ id, question: id.toUpperCase() } as Problem);

describe("cutting notes down", () => {
  it("keeps the first sentences, without splitting on O(n) or decimals", () => {
    expect(firstSentences("Sort first. Then sweep in O(n). Done.", 2)).toBe("Sort first. Then sweep in O(n).");
    expect(firstSentences("Use 0.5 as the ratio. Next.", 1)).toBe("Use 0.5 as the ratio.");
  });

  it("reduces a complexity note to its big-Os", () => {
    expect(costOf("O(log n) time, because it halves; O(1) space.")).toBe("O(log n) · O(1)");
    expect(costOf("O(n log(n)) time and O(n) space")).toBe("O(n log(n)) · O(n)");
    expect(costOf("Linear. Constant extra.")).toBe("Linear.");
    expect(costOf("")).toBe("");
  });

  it("the trick is the key insight and reminder, else the start of the approach", () => {
    expect(trickOf(solved({ keyInsight: "Sorted, so halve.", reminder: "low<=high" }))).toEqual({ insight: "Sorted, so halve.", reminder: "low<=high" });
    expect(trickOf(solved({}, { approach: "Two pointers. Move the smaller. Return." })).insight).toBe("Two pointers. Move the smaller.");
  });

  it("the compact card drops code and repeats nothing", () => {
    const p = solved(
      { keyInsight: "Transpose, then reverse rows.", commonMistake: "j from 0 swaps twice. Also more.", complexity: "O(n^2) time, O(1) space" },
      { approach: "Transpose, then reverse rows.", code: "class S {}", mistakes: [{ at: "x", what: "wrong", remember: "j from i+1" }] }
    );
    expect(compactOf(p)).toEqual({
      insight: "Transpose, then reverse rows.",
      approach: "",
      traps: ["j from 0 swaps twice.", "j from i+1"],
      cost: "O(n^2) · O(1)",
      pseudocode: "",
    });
    expect(cheatRowOf(p)).toEqual({ trick: "Transpose, then reverse rows.", trap: "j from 0 swaps twice.", cost: "O(n^2) · O(1)" });
  });
});

describe("pattern card", () => {
  it("puts the when-to-use concepts first and caps them", () => {
    const concepts = patternConcepts("arrays__sliding-window");
    expect(concepts.length).toBeLessThanOrEqual(4);
    expect(concepts[0].tags).toContain("recognition");
    expect(concepts.every((c) => c.criticality === "core")).toBe(true);
  });

  it("lists each of your traps once", () => {
    const entries = [
      { problem: problem("a"), progress: solved({ commonMistake: "Forgot to shrink." }), written: true },
      { problem: problem("b"), progress: solved({ commonMistake: "forgot to shrink." }, { mistakes: [{ at: "x", what: "Off by one", remember: "" }] }), written: true },
    ];
    expect(patternTraps(entries)).toEqual([
      { problem: "A", text: "Forgot to shrink." },
      { problem: "B", text: "Off by one" },
    ]);
  });
});

describe("buildDeck", () => {
  const book = (entries: [string, QuestionProgressV2][]): NotebookTopic[] => [
    {
      id: "t", name: "T", solved: entries.length, written: entries.length,
      patterns: [{ id: "t__p", name: "P", entries: entries.map(([id, progress]) => ({ problem: problem(id), progress, written: true })) }],
    },
  ];
  const insight = { keyInsight: "trick" };

  it("leaves out problems with nothing to recall, and orders blanks, fuzzy, new, then known", () => {
    const deck = buildDeck(
      book([
        ["known", solved(insight, { sweep: { at: "2026-10-01", rating: "knew", streak: 1 } })],
        ["new", solved(insight)],
        ["empty", solved()],
        ["fuzzy", solved(insight, { sweep: { at: "2026-10-01", rating: "fuzzy", streak: 0 } })],
        ["blank", solved(insight, { sweep: { at: "2026-10-01", rating: "blank", streak: 0 } })],
        ["fresh", solved(insight, { sweep: { at: "2026-10-13", rating: "knew", streak: 1 } })],
      ]),
      "2026-10-14"
    );
    const p = deck[0].patterns[0];
    expect(p.cards.map((c) => c.entry.problem.id)).toEqual(["known", "new", "fuzzy", "blank", "fresh"]);
    expect(p.due.map((c) => c.entry.problem.id)).toEqual(["blank", "fuzzy", "new", "known"]);
    expect(p.unwritten).toBe(1);
    expect(deck[0]).toMatchObject({ cards: 5, due: 4, unwritten: 1 });
    expect(estimateMinutes(deck[0].patterns)).toBe(1); // 4 x 8s + 45s
    expect(estimateMinutes([])).toBe(0);
  });
});
