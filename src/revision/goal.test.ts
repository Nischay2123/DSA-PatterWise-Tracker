import { describe, expect, it } from "vitest";
import idRegistry from "../../data/idRegistry.json";
import questionsData from "../../data/questions.json";
import { emptyAppStoreV2 } from "../persistence/migrate";
import { buildTopicRows, canReviseManually, problemsUntilRevisable } from "./dashboard";
import { REVISION_CONFIG } from "../config";
import {
  ALL_DIFFICULTIES,
  DEFAULT_GOAL,
  FULL_GOAL,
  GOAL_MIN_TOPIC_PROBLEMS,
  GOAL_PRESETS,
  getCuratedList,
  goalPresetId,
  goalScoped,
  isDefaultGoal,
  isTopicOutOfGoalScope,
  matchesGoal,
  resolveGoal,
  sameGoal,
  summarizeGoal,
} from "./goal";
import type { Goal } from "./goal";
import type { Problem, ProgressStore, QuestionData } from "../types";

const DATA = questionsData as QuestionData;
const ALL = DATA.topics.flatMap((t) => t.patterns.flatMap((p) => p.problems));

function problem(over: Partial<Problem> = {}): Problem {
  return {
    id: "x",
    subpattern: "",
    question: "Q",
    platform: "-",
    link: null,
    difficulty: "Medium",
    originalStep: "",
    estMinutes: "10",
    importance: "Medium",
    interviewFreq: "Medium",
    ...over,
  };
}

const goal = (over: Partial<Goal> = {}): Goal => ({ ...FULL_GOAL, ...over });

describe("matchesGoal -- frequency is a floor, not an equality test", () => {
  it("admits everything at or above the floor", () => {
    const g = goal({ minFreq: "High" });
    expect(matchesGoal(problem({ interviewFreq: "Very High" }), g)).toBe(true);
    expect(matchesGoal(problem({ interviewFreq: "High" }), g)).toBe(true);
  });

  it("rejects everything below the floor", () => {
    const g = goal({ minFreq: "High" });
    expect(matchesGoal(problem({ interviewFreq: "Medium" }), g)).toBe(false);
    expect(matchesGoal(problem({ interviewFreq: "Low" }), g)).toBe(false);
  });

  it('admits every frequency, including unknown values, at the "All" floor', () => {
    expect(matchesGoal(problem({ interviewFreq: "Low" }), FULL_GOAL)).toBe(true);
    expect(matchesGoal(problem({ interviewFreq: "nonsense" }), FULL_GOAL)).toBe(true);
  });

  it("treats an unrecognised frequency as below any real floor rather than letting it through", () => {
    expect(matchesGoal(problem({ interviewFreq: "" }), goal({ minFreq: "Medium" }))).toBe(false);
    expect(matchesGoal(problem({ interviewFreq: "Extremely High" }), goal({ minFreq: "Medium" }))).toBe(false);
  });

  it("applies difficulty independently of frequency", () => {
    const g = goal({ minFreq: "High", difficulties: ["Easy", "Medium"] });
    expect(matchesGoal(problem({ interviewFreq: "Very High", difficulty: "Hard" }), g)).toBe(false);
    expect(matchesGoal(problem({ interviewFreq: "Very High", difficulty: "Easy" }), g)).toBe(true);
  });
});

describe("resolveGoal -- settings arrive from IndexedDB and imported files", () => {
  it("falls back to the full syllabus when no goal was ever set", () => {
    expect(resolveGoal(undefined)).toEqual(DEFAULT_GOAL);
    expect(resolveGoal({ goal: undefined })).toEqual(DEFAULT_GOAL);
  });

  it("discards an unrecognised frequency floor rather than trusting it", () => {
    expect(resolveGoal({ goal: { minFreq: "Enormous", difficulties: [...ALL_DIFFICULTIES] } }).minFreq).toBe("All");
  });

  it("drops junk difficulties and returns them canonically ordered", () => {
    const resolved = resolveGoal({ goal: { minFreq: "High", difficulties: ["Hard", "bogus", "Easy"] } });
    expect(resolved.difficulties).toEqual(["Easy", "Hard"]);
  });

  it("refuses an empty difficulty set, which would silently scope everything to nothing", () => {
    expect(resolveGoal({ goal: { minFreq: "High", difficulties: [] } }).difficulties).toEqual([...ALL_DIFFICULTIES]);
    expect(resolveGoal({ goal: { minFreq: "High", difficulties: ["nope"] } }).difficulties).toEqual([
      ...ALL_DIFFICULTIES,
    ]);
  });

  it("survives a non-object goal", () => {
    expect(resolveGoal({ goal: null as never })).toEqual(DEFAULT_GOAL);
    expect(resolveGoal({ goal: "sprint" as never })).toEqual(DEFAULT_GOAL);
  });
});

describe("isTopicOutOfGoalScope -- only a goal that NARROWS can disqualify a topic", () => {
  const twoProblems = [problem({ id: "a" }), problem({ id: "b" })];

  it("never drops a topic under the default goal, however small it is", () => {
    expect(isTopicOutOfGoalScope(twoProblems, FULL_GOAL)).toBe(false);
    expect(isTopicOutOfGoalScope([problem({ id: "a" })], FULL_GOAL)).toBe(false);
  });

  it("leaves a small topic alone when the goal happens to keep all of it", () => {
    const bothHigh = [problem({ id: "a", interviewFreq: "High" }), problem({ id: "b", interviewFreq: "High" })];
    expect(isTopicOutOfGoalScope(bothHigh, goal({ minFreq: "High" }))).toBe(false);
  });

  it("drops a topic the goal thinned below the floor", () => {
    const mostlyLow = [
      problem({ id: "a", interviewFreq: "High" }),
      ...Array.from({ length: 10 }, (_, i) => problem({ id: `l${i}`, interviewFreq: "Low" })),
    ];
    expect(isTopicOutOfGoalScope(mostlyLow, goal({ minFreq: "High" }))).toBe(true);
  });

  it(`keeps a topic sitting exactly on the floor of ${GOAL_MIN_TOPIC_PROBLEMS}`, () => {
    const onFloor = [
      ...Array.from({ length: GOAL_MIN_TOPIC_PROBLEMS }, (_, i) => problem({ id: `h${i}`, interviewFreq: "High" })),
      problem({ id: "low", interviewFreq: "Low" }),
    ];
    expect(isTopicOutOfGoalScope(onFloor, goal({ minFreq: "High" }))).toBe(false);
  });
});

describe("presets", () => {
  it("round-trips every preset through goalPresetId", () => {
    for (const preset of GOAL_PRESETS) expect(goalPresetId(preset.goal)).toBe(preset.id);
  });

  it("reports a goal matching no preset as custom", () => {
    expect(goalPresetId(goal({ minFreq: "Medium", difficulties: ["Easy"] }))).toBe("custom");
  });

  it("treats difficulty order as irrelevant when comparing goals", () => {
    expect(sameGoal(goal({ difficulties: ["Hard", "Easy", "Medium"] }), FULL_GOAL)).toBe(true);
    expect(isDefaultGoal({ ...DEFAULT_GOAL, difficulties: ["Hard", "Easy", "Medium"] })).toBe(true);
  });

  it("does not treat a narrower goal as the default", () => {
    expect(isDefaultGoal(goal({ minFreq: "High" }))).toBe(false);
    expect(isDefaultGoal(goal({ difficulties: ["Easy", "Medium"] }))).toBe(false);
  });
});

// Guards the numbers the Settings screen promises against the real dataset,
// so a future edit to questions.json that changes them fails here loudly
// rather than silently shifting what a preset means.
describe("against the real dataset", () => {
  it("scopes the default goal to exactly the 467-problem A2Z sheet, and Full syllabus to all 649", () => {
    expect(ALL.length).toBe(649);
    expect(goalScoped(ALL, FULL_GOAL)).toHaveLength(649);
    const sheet = Object.keys(idRegistry).sort();
    expect(goalScoped(ALL, DEFAULT_GOAL).map((p) => p.id).sort()).toEqual(sheet);
    expect(sheet).toHaveLength(467);
  });

  it("scopes the interview sprint to the 239 High-and-above problems", () => {
    const sprint = GOAL_PRESETS.find((p) => p.id === "sprint")!.goal;
    expect(goalScoped(ALL, sprint)).toHaveLength(239);
  });

  it("drops exactly the three topics the sprint thins below the floor", () => {
    const sprint = GOAL_PRESETS.find((p) => p.id === "sprint")!.goal;
    const scope = summarizeGoal(DATA.topics, sprint);
    expect(scope.problems).toBe(239);
    expect(scope.names.sort()).toEqual(["Advanced Strings", "Recursion", "Sorting"]);
    expect(scope.topicsInScope).toBe(14);
  });

  // One row per preset, so a change to questions.json that shifts what a
  // preset means fails loudly here instead of quietly changing the product.
  it.each([
    ["full", 604, 17, 0],
    ["no-hard", 450, 16, 1],
    ["a2z", 422, 17, 0],
    ["nc250", 249, 14, 3],
    ["sprint", 239, 14, 3],
    ["hard-only", 154, 13, 4],
    ["lc150", 149, 14, 3],
    ["nc150", 149, 14, 3],
    ["blind75", 75, 10, 7],
    ["lc75", 75, 11, 6],
  ])("scopes the %s preset to %i problems across %i topics", (id, problems, topicsInScope, dropped) => {
    const preset = GOAL_PRESETS.find((p) => p.id === id)!;
    const scope = summarizeGoal(DATA.topics, preset.goal);
    expect(scope.problems).toBe(problems);
    expect(scope.topicsInScope).toBe(topicsInScope);
    expect(scope.topicsDropped).toBe(dropped);
  });

  it("gives every preset a distinct scope, so none is a duplicate of another", () => {
    const seen = GOAL_PRESETS.map(
      (p) => p.goal.listId ?? `${p.goal.minFreq}|${[...p.goal.difficulties].sort().join()}`
    );
    expect(new Set(seen).size).toBe(GOAL_PRESETS.length);
  });

  it("orders the presets widest to narrowest", () => {
    const sizes = GOAL_PRESETS.map((p) => summarizeGoal(DATA.topics, p.goal).problems);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("counts the full syllabus as every non-exempt topic, with none dropped", () => {
    const scope = summarizeGoal(DATA.topics, DEFAULT_GOAL);
    expect(scope.topicsDropped).toBe(0);
    // 18 topics minus the exempt `fundamentals`; the A2Z default is the old 422.
    expect(scope.topicsInScope).toBe(17);
    expect(scope.problems).toBe(422);
  });

  it("confirms importance carries no information frequency does not, which is why it is not a goal axis", () => {
    const byFreq = new Set(ALL.filter((p) => ["High", "Very High"].includes(p.interviewFreq)).map((p) => p.id));
    const byImportance = new Set(ALL.filter((p) => p.importance === "High").map((p) => p.id));
    expect(byFreq.size).toBe(byImportance.size);
    expect([...byFreq].every((id) => byImportance.has(id))).toBe(true);
  });
});


// The whole point of the feature, asserted end to end through the same
// function the dashboard renders from.
describe("a goal unlocks revision sooner -- the reason this exists", () => {
  const SPRINT = GOAL_PRESETS.find((p) => p.id === "sprint")!.goal;
  const arrays = DATA.topics.find((t) => t.id === "arrays")!;
  const arraysProblems = arrays.patterns.flatMap((p) => p.problems);

  function storeWith(ids: string[]): ProgressStore {
    return {
      version: 1,
      problems: Object.fromEntries(
        ids.map((id) => [id, { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null }])
      ),
    };
  }

  function v2WithGoal(goal: typeof SPRINT | null) {
    const v2 = emptyAppStoreV2();
    if (goal) v2.settings = { ...v2.settings, goal };
    return v2;
  }

  function rowFor(store: ProgressStore, goal: typeof SPRINT | null) {
    return buildTopicRows([arrays], store, v2WithGoal(goal))[0];
  }

  it("needs 39 of the sheet's 51 to unlock Arrays under the default goal, as before the merge", () => {
    const sheetIds = goalScoped(arraysProblems, DEFAULT_GOAL).map((p) => p.id);
    expect(arraysProblems).toHaveLength(98);
    expect(sheetIds).toHaveLength(51);
    const under = storeWith(sheetIds.slice(0, 38));
    expect(rowFor(under, null).state).toBe("IN_PROGRESS");
    const at = storeWith(sheetIds.slice(0, 39));
    expect(rowFor(at, null).state).toBe("REVISION_DUE");
    // The questions merged in later do not dilute it.
    expect(rowFor(storeWith(sheetIds.slice(0, 39)), FULL_GOAL).state).toBe("IN_PROGRESS");
  });

  it("needs only 30 of 39 to unlock Arrays on the interview sprint", () => {
    const goalIds = goalScoped(arraysProblems, SPRINT).map((p) => p.id);
    expect(goalIds).toHaveLength(39);

    const under = storeWith(goalIds.slice(0, 29));
    expect(rowFor(under, SPRINT).state).toBe("IN_PROGRESS");

    const at = storeWith(goalIds.slice(0, 30));
    expect(rowFor(at, SPRINT).state).toBe("REVISION_DUE");
    // ...and that exact same progress is nowhere near enough on the full
    // syllabus, which is the whole difference the goal makes.
    expect(rowFor(at, null).state).toBe("IN_PROGRESS");
  });

  it("ignores out-of-goal progress when a goal is set", () => {
    const offGoal = arraysProblems.filter((p) => !matchesGoal(p, SPRINT)).map((p) => p.id);
    expect(offGoal.length).toBeGreaterThan(13);
    // 34 solved problems, none of them in the goal => still nothing to revise.
    expect(rowFor(storeWith(offGoal), SPRINT).state).toBe("NOT_STARTED");
  });

  it("omits the topics the sprint thins below the floor from the dashboard entirely", () => {
    const rows = buildTopicRows(DATA.topics, storeWith([]), v2WithGoal(SPRINT));
    const names = rows.map((r) => r.name);
    expect(names).toHaveLength(14);
    expect(names).not.toContain("Recursion");
    expect(names).toContain("Arrays");
  });

  it("still lists all 17 non-exempt topics under the default goal", () => {
    expect(buildTopicRows(DATA.topics, storeWith([]), v2WithGoal(null))).toHaveLength(17);
  });
});


describe("curated lists -- a set of problems, not a predicate", () => {
  const blind = GOAL_PRESETS.find((p) => p.id === "blind75")!.goal;
  const list = getCuratedList("blind75")!;

  it("never invents an id: every listed problem exists in the sheet", () => {
    const known = new Set(ALL.map((p) => p.id));
    expect(list.ids.filter((id) => !known.has(id))).toEqual([]);
  });

  it("accounts for all 75 -- what is present plus what is recorded absent", () => {
    expect(list.ids).toHaveLength(75);
    expect(list.absent).toHaveLength(0);
    expect(list.ids.length + list.absent.length).toBe(list.total);
  });

  it("holds no duplicate ids", () => {
    expect(new Set(list.ids).size).toBe(list.ids.length);
  });

  it("selects exactly the listed problems and nothing else", () => {
    const selected = goalScoped(ALL, blind).map((p) => p.id).sort();
    expect(selected).toEqual([...list.ids].sort());
  });

  it("ignores the frequency and difficulty fields while a list is set", () => {
    // A list is exhaustive by definition; narrowing it further would shrink
    // a set whose whole point is being fixed and known.
    const narrowed = { ...blind, minFreq: "Very High" as const, difficulties: ["Hard" as const] };
    expect(goalScoped(ALL, narrowed)).toHaveLength(75);
  });

  it("falls back to the predicate when the list id is unknown", () => {
    const resolved = resolveGoal({ goal: { minFreq: "High", difficulties: ["Easy"], listId: "grind169" } });
    expect(resolved.listId).toBeUndefined();
    expect(resolved.minFreq).toBe("High");
    expect(goalScoped(ALL, resolved).length).toBeGreaterThan(0);
  });

  it("round-trips a list goal through resolveGoal", () => {
    expect(resolveGoal({ goal: blind }).listId).toBe("blind75");
    expect(goalPresetId(resolveGoal({ goal: blind }))).toBe("blind75");
  });

  it("does not confuse a list goal with the default goal", () => {
    expect(isDefaultGoal(blind)).toBe(false);
    expect(sameGoal(blind, DEFAULT_GOAL)).toBe(false);
  });
});


describe("manual revision -- revise a topic whenever you decide to", () => {
  const arrays = DATA.topics.find((t) => t.id === "arrays")!;
  const arraysProblems = arrays.patterns.flatMap((p) => p.problems);
  const MIN = REVISION_CONFIG.manualRevisionMinCompleted;

  function rowWith(doneIds: string[], goal?: Goal) {
    const store: ProgressStore = {
      version: 1,
      problems: Object.fromEntries(
        doneIds.map((id) => [id, { done: true, revise: false, notes: "", completedAt: "2026-01-01", revisedAt: null }])
      ),
    };
    const v2 = emptyAppStoreV2();
    if (goal) v2.settings = { ...v2.settings, goal };
    return buildTopicRows([arrays], store, v2)[0];
  }

  it("is blocked until a whole session can be filled without repeating a question", () => {
    expect(MIN).toBe(REVISION_CONFIG.questionsPerSession);
    const justUnder = rowWith(arraysProblems.slice(0, MIN - 1).map((p) => p.id));
    expect(canReviseManually(justUnder)).toBe(false);
    expect(problemsUntilRevisable(justUnder)).toBe(1);

    const exactly = rowWith(arraysProblems.slice(0, MIN).map((p) => p.id));
    expect(canReviseManually(exactly)).toBe(true);
    expect(problemsUntilRevisable(exactly)).toBe(0);
  });

  it("unlocks far below the threshold the scheduler waits for", () => {
    // 3 of 51 is 6% -- the scheduler would not schedule anything until 75%,
    // and that is exactly the wait this feature exists to skip.
    const row = rowWith(arraysProblems.slice(0, MIN).map((p) => p.id));
    expect(row.state).toBe("IN_PROGRESS");
    expect(row.completionPct).toBeLessThan(0.1);
    expect(canReviseManually(row)).toBe(true);
  });

  it("counts only problems inside the goal scope, since that is what a session draws from", () => {
    const SPRINT = GOAL_PRESETS.find((p) => p.id === "sprint")!.goal;
    const offGoal = arraysProblems.filter((p) => !matchesGoal(p, SPRINT)).slice(0, 10).map((p) => p.id);
    // Ten solved problems, none of them in the goal, so nothing to revise.
    const row = rowWith(offGoal, SPRINT);
    expect(row.completedInScope).toBe(0);
    expect(canReviseManually(row)).toBe(false);

    const inGoal = goalScoped(arraysProblems, SPRINT).slice(0, MIN).map((p) => p.id);
    expect(canReviseManually(rowWith([...offGoal, ...inGoal], SPRINT))).toBe(true);
  });

  it("never reports a negative shortfall once well past the minimum", () => {
    const row = rowWith(arraysProblems.slice(0, 20).map((p) => p.id));
    expect(problemsUntilRevisable(row)).toBe(0);
  });
});
