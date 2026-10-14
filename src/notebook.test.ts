import { describe, expect, it } from "vitest";
import questionsData from "../data/questions.json";
import { buildNotebook } from "./notebook";
import { emptyAppStoreV2, liftV1Entry } from "./persistence/migrate";
import { DEFAULT_GOAL, FULL_GOAL } from "./revision/goal";
import type { AppStoreV2, QuestionData, QuestionProgressV2 } from "./types";

const DATA = questionsData as QuestionData;
const SHEET = "arrays__two-pointers__3-sum"; // an A2Z problem
const EXTRA = "arrays__two-pointers__two-sum-ii-input-array-is-sorted"; // NeetCode / LeetCode only

const solved = (patch: Partial<QuestionProgressV2> = {}): QuestionProgressV2 => ({
  ...liftV1Entry({ done: true, revise: false, notes: "", completedAt: "2026-08-01", revisedAt: null }),
  ...patch,
});
const store = (progress: AppStoreV2["progress"]): AppStoreV2 => ({ ...emptyAppStoreV2(), progress });

describe("buildNotebook", () => {
  it("lists only solved problems, in sheet order, and drops empty patterns and topics", () => {
    const later = "arrays__two-pointers__4-sum";
    const book = buildNotebook(
      DATA.topics,
      store({ [later]: solved(), [SHEET]: solved(), "arrays__two-pointers__remove-element": solved({ completed: false }) }),
      FULL_GOAL
    );
    expect(book.map((t) => t.id)).toEqual(["arrays"]);
    expect(book[0].patterns.map((p) => p.id)).toEqual(["arrays__two-pointers"]);
    expect(book[0].patterns[0].entries.map((e) => e.problem.id)).toEqual([SHEET, later]); // 3Sum comes before 4Sum
  });

  it("follows the chosen sheet", () => {
    const progress = { [SHEET]: solved(), [EXTRA]: solved() };
    const ids = (b: ReturnType<typeof buildNotebook>) => b.flatMap((t) => t.patterns.flatMap((p) => p.entries.map((e) => e.problem.id)));
    expect(ids(buildNotebook(DATA.topics, store(progress), DEFAULT_GOAL))).toEqual([SHEET]);
    expect(ids(buildNotebook(DATA.topics, store(progress), FULL_GOAL)).sort()).toEqual([SHEET, EXTRA].sort());
  });

  it("counts a problem as written when it has a note, a solution field or a mistake", () => {
    const withNote = solved();
    withNote.notes = { ...withNote.notes, keyInsight: "sort, then two pointers" };
    const book = buildNotebook(
      DATA.topics,
      store({
        [SHEET]: withNote,
        "arrays__two-pointers__4-sum": solved({ code: "class S {}" }),
        "arrays__two-pointers__remove-element": solved({ mistakes: [{ at: "2026-08-01", what: "off by one", remember: "" }] }),
        "arrays__two-pointers__reverse-string": solved(),
      }),
      FULL_GOAL
    );
    expect(book[0].solved).toBe(4);
    expect(book[0].written).toBe(3);
    expect(book[0].patterns[0].entries.find((e) => e.problem.id.endsWith("reverse-string"))!.written).toBe(false);
  });
});
