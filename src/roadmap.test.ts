/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import questionsData from "../data/questions.json";
import { SOURCES } from "./config";
import { NOTES_BY_ID } from "./notes";
import { DEFAULT_GOAL, FULL_GOAL } from "./revision/goal";
import { doneTopics, findNextUp, isProblemVisible, unmetPrereqs } from "./store";
import type { FilterState, Problem, ProblemState, ProgressStore, QuestionData, Topic } from "./types";

const DATA = questionsData as QuestionData;
const ALL = DATA.topics.flatMap((t) => t.patterns.flatMap((p) => p.problems));

const filters = (patch: Partial<FilterState> = {}): FilterState => ({
  search: "",
  difficulty: "All",
  importance: "All",
  freq: "All",
  hideCompleted: false,
  reviseOnly: false,
  goalOnly: true,
  ...patch,
});
const undone: ProblemState = { done: false, revise: false, notes: "", completedAt: null, revisedAt: null };
const ctx = { topicName: "", patternName: "" };

function problem(id: string, patch: Partial<Problem> = {}): Problem {
  return {
    id,
    subpattern: "",
    question: id,
    platform: "",
    link: null,
    difficulty: "Easy",
    originalStep: "",
    estMinutes: "",
    importance: "Medium",
    interviewFreq: "Medium",
    ...patch,
  };
}
const topic = (id: string, ids: string[], prereqs: string[] = [], needs: Record<string, string[]> = {}): Topic => ({
  id,
  name: id.toUpperCase(),
  prereqs,
  patterns: [{ id: `${id}__p`, name: "P", problems: ids.map((pid) => problem(pid, { needs: needs[pid] })) }],
});
const solved = (ids: string[]): ProgressStore => ({
  version: 1,
  idsMigrated: true,
  problems: Object.fromEntries(ids.map((id) => [id, { ...undone, done: true, completedAt: "2026-01-01" }])),
});

describe("list visibility", () => {
  const added = ALL.find((p) => !p.sources?.includes("A2Z"))!;

  it("shows only the chosen sheet while the sheet filter is on, and everything under Full syllabus", () => {
    expect(isProblemVisible(added, undone, filters(), { ...ctx, goal: DEFAULT_GOAL })).toBe(false);
    expect(isProblemVisible(added, undone, filters({ goalOnly: false }), { ...ctx, goal: DEFAULT_GOAL })).toBe(true);
    expect(isProblemVisible(added, undone, filters(), { ...ctx, goal: FULL_GOAL })).toBe(true);
    expect(isProblemVisible(added, undone, filters(), { ...ctx, goal: { ...FULL_GOAL, listId: "blind75" } })).toBe(
      added.sources!.includes("B75")
    );
  });

  it("filters by pattern and by status", () => {
    const own = DATA.topics.flatMap((t) => t.patterns).find((p) => p.problems.includes(added))!;
    expect(isProblemVisible(added, undone, filters({ pattern: own.id }), ctx)).toBe(true);
    expect(isProblemVisible(added, undone, filters({ pattern: "arrays__hashing-not-this" }), ctx)).toBe(false);
    // A pattern id that is a prefix of another must not match its neighbour.
    expect(isProblemVisible(problem("dp__1d-dp__x"), undone, filters({ pattern: "dp__1d" }), ctx)).toBe(false);
    expect(isProblemVisible(added, undone, filters({ solvedOnly: true }), ctx)).toBe(false);
    expect(isProblemVisible(added, { ...undone, done: true }, filters({ solvedOnly: true }), ctx)).toBe(true);
    expect(isProblemVisible(added, undone, filters({ dueOnly: true }), ctx)).toBe(false);
    expect(isProblemVisible(added, undone, filters({ dueOnly: true }), { ...ctx, due: new Set([added.id]) })).toBe(true);
  });
});

describe("topic prerequisites", () => {
  // b needs a; c needs b, and c2 additionally needs d.
  const topics = [
    topic("a", ["a1", "a2", "a3", "a4"]),
    topic("b", ["b1"], ["a"]),
    topic("c", ["c1", "c2"], ["b"], { c2: ["d"] }),
    topic("d", ["d1"]),
  ];

  it("counts a topic done at the revision threshold, 75%", () => {
    expect(doneTopics(topics, solved(["a1", "a2"]), FULL_GOAL).has("a")).toBe(false);
    expect(doneTopics(topics, solved(["a1", "a2", "a3"]), FULL_GOAL).has("a")).toBe(true);
  });

  it("never locks anything behind an exempt topic", () => {
    expect(doneTopics([topic("fundamentals", ["f1"])], solved([]), FULL_GOAL).has("fundamentals")).toBe(true);
  });

  it("walks Next up past locked topics and problems, falling back when everything is locked", () => {
    expect(findNextUp(topics, solved(["a1", "a2", "a3"]), filters(), FULL_GOAL)?.id).toBe("a4");
    expect(findNextUp(topics, solved(["a1", "a2", "a3", "a4"]), filters(), FULL_GOAL)?.id).toBe("b1");
    // b done, so c is open -- but c2 still needs d.
    const store = solved(["a1", "a2", "a3", "a4", "b1", "c1"]);
    expect(unmetPrereqs(["d"], doneTopics(topics, store, FULL_GOAL))).toEqual(["d"]);
    expect(findNextUp(topics, store, filters(), FULL_GOAL)?.id).toBe("d1");
    // With locks off in Settings, Continue ignores prerequisites entirely.
    expect(findNextUp(topics, solved(["a1", "a2", "a3", "a4", "b1", "c1"]), filters(), FULL_GOAL, false)?.id).toBe("c2");
    // Two topics each waiting on the other: nothing is unlocked, so the first unsolved.
    expect(findNextUp([topic("x", ["x1"], ["y"]), topic("y", ["y1"], ["x"])], solved([]), filters(), FULL_GOAL)?.id).toBe("x1");
  });
});

describe("questions.json after the roadmap merge", () => {
  const topicIds = new Set(DATA.topics.map((t) => t.id));

  it("references only real topics, sources and notes", () => {
    for (const t of DATA.topics) {
      expect(t.prereqs!.filter((p) => !topicIds.has(p)), t.id).toEqual([]);
      for (const id of t.notes ?? []) {
        expect(NOTES_BY_ID[id], `${t.id} note ${id}`).toBeDefined();
      }
    }
    for (const p of ALL) {
      expect((p.needs ?? []).filter((n) => !topicIds.has(n)), p.id).toEqual([]);
      expect((p.sources ?? []).filter((s) => !(s in SOURCES)), p.id).toEqual([]);
      for (const url of [p.link, p.video, p.article, ...Object.values(p.alt ?? {})].filter(Boolean))
        expect(url, p.id).toMatch(/^https?:\/\//);
    }
  });

  it("ships every note file it links to", () => {
    const shipped = new Set(Object.keys(import.meta.glob("../public/notes/**/*.md")).map((f) => f.replace("../public/", "")));
    for (const n of Object.values(NOTES_BY_ID)) expect(shipped.has(n.file), n.file).toBe(true);
    expect(shipped.size).toBe(Object.keys(NOTES_BY_ID).length);
  });

  it("never lists one question twice", () => {
    expect(new Set(ALL.map((p) => p.id)).size).toBe(ALL.length);
  });
});
