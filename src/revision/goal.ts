import listsData from "../../data/lists.json";
import { REVISION_CONFIG } from "../config";
import type { AppSettings, Problem, ProgressStore, Topic } from "../types";

// ─── The revision goal ──────────────────────────────────────────────────────
//
// Revision doesn't unlock until a topic reaches REVISION_CONFIG
// .completionThreshold of its problems. Against the full 467 that means 39
// solved before Arrays will schedule anything, which is a long wait for
// someone re-doing the syllabus. A goal narrows the DENOMINATOR: same
// threshold, smaller scope, so revision starts working within days.
//
// Two deliberate departures from the browsing filters in store.ts:
//
//  1. THRESHOLD, not equality. isProblemVisible does
//     `problem.interviewFreq === filters.freq` -- an exact match. A goal
//     wants "High and above", because exactly-Very-High is 49 problems and
//     leaves six topics with none at all.
//
//  2. NO importance dimension. In data/questions.json importance is
//     perfectly collinear with interviewFreq -- {Very High, High} => High
//     and {Medium, Low} => Medium, with no exceptions, so `importance: High`
//     and `freq >= High` select the identical 143 problems. Offering it as a
//     second axis would be a control that pretends to do something.
//
// That leaves exactly two real axes: a frequency floor and a difficulty set.

// Lives here rather than in dashboard.ts because goal scoping needs it and
// dashboard.ts already depends on this module -- defining it there made the
// two import each other, which happens to work today only because every use
// is at call time. dashboard.ts re-exports it for its existing callers.
export function isExemptTopic(topicId: string): boolean {
  return (REVISION_CONFIG.exemptTopics as readonly string[]).includes(topicId);
}

export type FreqFloor = "All" | "Medium" | "High" | "Very High";
export type Difficulty = "Easy" | "Medium" | "Hard";

// Ascending. Anything not on this list reads as below the lowest rung.
const FREQ_ORDER: readonly string[] = ["Low", "Medium", "High", "Very High"];
const FREQ_FLOORS: readonly FreqFloor[] = ["All", "Medium", "High", "Very High"];

export const ALL_DIFFICULTIES: readonly Difficulty[] = ["Easy", "Medium", "Hard"];

// ─── Curated lists ──────────────────────────────────────────────────────────
// A goal is normally a predicate. Some goals are not expressible as one:
// "Blind 75" is a specific set of problems, not a rule. Those live in
// data/lists.json as explicit id sets and, when a goal names one, membership
// replaces the predicate entirely.
//
// The lists reference frozen ids and never invent them. Where a listed
// problem is simply not in this sheet it is recorded in `absent` rather than
// padded with a near-match, so the count the UI shows is the true overlap.
export interface CuratedList {
  label: string;
  note: string;
  /** Size of the canonical list, which is >= ids.length. */
  total: number;
  ids: string[];
  absent: string[];
}

export const CURATED_LISTS = listsData as Record<string, CuratedList>;

export function getCuratedList(listId: string | undefined): CuratedList | null {
  return listId ? (CURATED_LISTS[listId] ?? null) : null;
}

export interface Goal {
  minFreq: FreqFloor;
  difficulties: Difficulty[];
  /** When set to a known list, membership replaces minFreq/difficulties. */
  listId?: string;
}

export const DEFAULT_GOAL: Goal = { minFreq: "All", difficulties: [...ALL_DIFFICULTIES] };

// A topic with fewer goal problems than this is dropped from revision
// entirely rather than scheduled against a handful.
//
// Without it the sprint goal breaks the scheduler on small topics: Recursion
// has ONE High+ problem, so solving it would put the topic at 100%, make it
// instantly due, and march it to MASTERED after three cycles -- a mastery
// badge for one problem. Sorting, Bit Manipulation, Tries and Advanced
// Strings each have two.
export const GOAL_MIN_TOPIC_PROBLEMS = 3;

export function matchesGoal(problem: Problem, goal: Goal): boolean {
  // A curated list is an exhaustive answer, not an extra filter -- narrowing
  // it further by frequency would silently shrink a list whose whole point
  // is being a fixed, known set.
  const list = getCuratedList(goal.listId);
  if (list) return list.ids.includes(problem.id);

  if (!goal.difficulties.includes(problem.difficulty)) return false;
  if (goal.minFreq === "All") return true;
  // indexOf returns -1 for a missing or unrecognised frequency, which is
  // below every real floor -- an unknown value is excluded rather than
  // silently passing.
  return FREQ_ORDER.indexOf(problem.interviewFreq) >= FREQ_ORDER.indexOf(goal.minFreq);
}

export function goalScoped<T extends Problem>(problems: T[], goal: Goal): T[] {
  return problems.filter((p) => matchesGoal(p, goal));
}

// Settings arrive from IndexedDB and from imported backup files, so this
// never trusts the shape it is handed. Absent goal => today's behaviour.
export function resolveGoal(settings: Pick<AppSettings, "goal"> | undefined | null): Goal {
  const raw = settings?.goal;
  if (!raw || typeof raw !== "object") return DEFAULT_GOAL;

  // An unknown list id -- a renamed list, or an import from a newer build --
  // must not silently scope everything to nothing, so it is dropped and the
  // frequency/difficulty fields underneath take over.
  const listId = getCuratedList(raw.listId) ? raw.listId : undefined;
  const minFreq = FREQ_FLOORS.includes(raw.minFreq as FreqFloor) ? (raw.minFreq as FreqFloor) : "All";
  // Rebuilt from ALL_DIFFICULTIES rather than copied, so the result is
  // always canonically ordered and free of junk entries.
  const difficulties = ALL_DIFFICULTIES.filter((d) => Array.isArray(raw.difficulties) && raw.difficulties.includes(d));

  // An empty difficulty set would scope every topic to nothing and silently
  // disable revision across the board; that is never what anyone meant.
  const resolved: Goal = { minFreq, difficulties: difficulties.length ? difficulties : [...ALL_DIFFICULTIES] };
  return listId ? { ...resolved, listId } : resolved;
}

export function sameGoal(a: Goal, b: Goal): boolean {
  // Two list goals are the same list or they are not; the predicate fields
  // underneath are inert while a list is set.
  if (a.listId || b.listId) return a.listId === b.listId;
  return (
    a.minFreq === b.minFreq &&
    a.difficulties.length === b.difficulties.length &&
    a.difficulties.every((d) => b.difficulties.includes(d))
  );
}

export function isDefaultGoal(goal: Goal): boolean {
  return sameGoal(goal, DEFAULT_GOAL);
}

export interface GoalPreset {
  id: string;
  label: string;
  description: string;
  goal: Goal;
}

// Ordered widest to narrowest so the counts descend as you read down and
// the list tells its own story. Every entry has to be a goal someone would
// actually hold, and every one has to be derivable without inventing data.
// Four candidates were measured and cut for failing one of those:
//
//   "Medium and above" scopes to 405 of 422 -- Full syllabus with a
//   rounding error, so choosing it would change nothing.
//   "Hard, High-frequency only" is 60 problems but strands 10 of 17 topics
//   below the floor, so most of the dashboard would vanish.
//   "Top 100 most asked" is not derivable at all. interviewFreq is a
//   four-value band (Very High 49, High 94) and there is no rank field, so
//   reaching exactly 100 means inventing an ordering for 51 of the 94.
//   `Most asked` below is the honest version of it: the full 143.
//   "High-frequency problems that exist on LeetCode" lands at a tempting
//   117, but the 26 it drops are LRU Cache, Dijkstra's, LIS, LCS, Disjoint
//   Set and the like -- a missing URL is a gap in the sheet, not a signal.
export const GOAL_PRESETS: GoalPreset[] = [
  {
    id: "full",
    label: "Full syllabus",
    description: "Every problem. Revision unlocks at 75% of a whole topic.",
    goal: DEFAULT_GOAL,
  },
  {
    id: "no-hard",
    label: "Skip the hard ones",
    description: "Easy and Medium across every topic. Rebuild breadth without hitting a wall.",
    goal: { minFreq: "All", difficulties: ["Easy", "Medium"] },
  },
  {
    // Kept as `sprint` -- the id is persisted in settings, so renaming it
    // would silently reset anyone already on this goal.
    id: "sprint",
    label: "Most asked",
    description: "The 143 the sheet marks High or Very High. Unlocks revision about three times sooner.",
    goal: { minFreq: "High", difficulties: [...ALL_DIFFICULTIES] },
  },
  {
    id: "hard-only",
    label: "Hard practice",
    description: "Only the Hard problems, for when the basics are already back.",
    goal: { minFreq: "All", difficulties: ["Hard"] },
  },
  {
    id: "blind75",
    label: "Blind 75",
    description: "The classic 75-problem list. 51 of them are in this sheet; the rest simply aren't.",
    goal: { minFreq: "All", difficulties: [...ALL_DIFFICULTIES], listId: "blind75" },
  },
];

// "custom" when the goal matches no preset -- the Settings radio group uses
// this to decide which row is selected.
export function goalPresetId(goal: Goal): string {
  return GOAL_PRESETS.find((p) => sameGoal(p.goal, goal))?.id ?? "custom";
}

export interface GoalScope {
  /** Problems in scope across every non-exempt topic. */
  problems: number;
  /** How many of those are already solved. Counted over the SAME set as
   *  `problems`, so it can never exceed it. */
  done: number;
  /** Topics revision will actually schedule. */
  topicsInScope: number;
  /** Topics with 1..GOAL_MIN_TOPIC_PROBLEMS-1 problems, dropped as too thin. */
  topicsDropped: number;
  names: string[];
}

// Drives the live counts beside each preset in Settings, so the cost of a
// choice ("143 problems, drops 5 topics") is visible before making it.
export function summarizeGoal(topics: Topic[], goal: Goal, store?: ProgressStore): GoalScope {
  let problems = 0;
  let done = 0;
  let topicsInScope = 0;
  const names: string[] = [];

  for (const topic of topics) {
    // Exempt topics are excluded because this describes REVISION scope, and
    // revision never touches them. That is also why this total (422) is
    // smaller than the tracker's headline count (467).
    if (isExemptTopic(topic.id)) continue;
    const inScope = goalScoped(topic.patterns.flatMap((p) => p.problems), goal);
    problems += inScope.length;
    if (store) done += inScope.filter((p) => store.problems[p.id]?.done).length;
    // A topic the goal did not narrow stays schedulable however small it is
    // -- same rule as isTopicOutOfGoalScope, and it must not drift from it.
    if (!isTopicOutOfGoalScope(topic.patterns.flatMap((p) => p.problems), goal)) topicsInScope++;
    else names.push(topic.name);
  }

  return { problems, done, topicsInScope, topicsDropped: names.length, names };
}

// A topic is out of scope when the goal NARROWED it below the floor.
// Callers fold this into deriveState's `isExempt`, which already means
// exactly "never scheduled, never gated, omitted from the dashboard".
//
// The second clause is what keeps the default goal inert: a topic the goal
// did not shrink at all is the same situation as the full syllabus, so it
// stays schedulable however small it is. Only a goal that threw problems
// away can disqualify a topic -- a genuinely two-problem topic is the data's
// business, not the goal's.
export function isTopicOutOfGoalScope(problems: Problem[], goal: Goal): boolean {
  const scoped = goalScoped(problems, goal).length;
  return scoped < GOAL_MIN_TOPIC_PROBLEMS && scoped < problems.length;
}
