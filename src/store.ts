import idMapRaw from "../data/idMap.json";
import { REVISION_CONFIG } from "./config";
import { isValidAppStoreV2, liftV1Entry } from "./persistence/migrate";
import { scoreEvaluation } from "./revision/evaluate";
import { recordAttemptOutcome, scheduleInitial } from "./revision/scheduler";
import type {
  AppSettings,
  AppStoreV2,
  EvaluationResult,
  FilterState,
  HeatmapDay,
  HeatmapMonth,
  Problem,
  ProblemState,
  ProgressStore,
  QuestionProgressV2,
  Topic,
  TopicRevision,
  V2Action,
} from "./types";

const STORE_KEY = "dsa-tracker-progress";
// One-shot undo-before-import/merge snapshot, holding the full v2 store (Phase
// 3 remediation). The old "dsa-tracker-progress-backup" key held only a lossy
// v1 projection and is no longer written or read -- any pre-existing undo
// snapshot there is orphaned, exactly like the other frozen legacy keys.
const V2_BACKUP_KEY = "dsa-tracker-progress-backup-v2";
const ID_MAP: Record<string, string> = idMapRaw;

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getState(store: ProgressStore, id: string): ProblemState {
  return store.problems[id] || { done: false, revise: false, notes: "", completedAt: null, revisedAt: null };
}

export function countDone(problems: { id: string }[], store: ProgressStore): number {
  return problems.reduce((n, p) => n + (getState(store, p.id).done ? 1 : 0), 0);
}

export function remapIds(problems: Record<string, ProblemState>, idMap: Record<string, string>) {
  const migrated: Record<string, ProblemState> = {};
  const orphaned: string[] = [];
  for (const [oldId, state] of Object.entries(problems)) {
    const newId = idMap[oldId];
    migrated[newId || oldId] = state;
    if (!newId) orphaned.push(oldId);
  }
  return { migrated, orphaned };
}

export function migrateIdsIfNeeded(store: ProgressStore): { store: ProgressStore; migrated: boolean } {
  if (store.idsMigrated) return { store, migrated: false };
  const { migrated: problems, orphaned } = remapIds(store.problems, ID_MAP);
  const next: ProgressStore = { ...store, problems, idsMigrated: true };
  if (orphaned.length) {
    console.warn(`ID migration: ${orphaned.length} unmapped id(s) preserved as-is (not dropped):`, orphaned);
  }
  return { store: next, migrated: true };
}

let warnedAboutSaveFailure = false;

export function saveStore(store: ProgressStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Private-mode Safari and full-quota browsers throw here. Silently failing
    // would leave ticked boxes that vanish on reload, so say so once.
    if (!warnedAboutSaveFailure) {
      warnedAboutSaveFailure = true;
      alert(
        "Your progress could not be saved — the browser is blocking local storage (private browsing or storage is full). Changes will be lost when you reload."
      );
    }
  }
}

export function loadStore(): ProgressStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (parsed && parsed.problems) {
      const { store, migrated } = migrateIdsIfNeeded(parsed);
      if (migrated) saveStore(store);
      return store;
    }
  } catch {
    // corrupt localStorage -- fall through to a fresh store
  }
  return { version: 1, problems: {}, idsMigrated: true };
}

// One-shot undo-before-import/merge snapshot. Stores the *complete* v2 store
// (Phase 3 remediation) so Undo restores pseudocode/code/notes/mistakes too,
// not just the five v1 fields.
export function saveBackupV2(v2: AppStoreV2): void {
  localStorage.setItem(V2_BACKUP_KEY, JSON.stringify(v2));
}

export function loadBackupV2(): AppStoreV2 | null {
  const raw = localStorage.getItem(V2_BACKUP_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidAppStoreV2(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearBackupV2(): void {
  localStorage.removeItem(V2_BACKUP_KEY);
}

export function hasBackupV2(): boolean {
  return !!localStorage.getItem(V2_BACKUP_KEY);
}

export function isValidStore(parsed: unknown): parsed is ProgressStore {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const p = parsed as Record<string, unknown>;
  return !!p.problems && typeof p.problems === "object" && !Array.isArray(p.problems);
}

export function countDoneInStore(store: ProgressStore): number {
  return Object.values(store.problems).filter((st) => st && st.done).length;
}

export function countDoneInStoreV2(v2: AppStoreV2): number {
  return Object.values(v2.progress).filter((p) => p.completed).length;
}

// The exported/downloaded copy of the store. Identical to the live v2 store
// except the API key is never written to a file that leaves the browser --
// "Including settings.apiKey in an export payload... " is a hard rule from
// the plan, and this is the one seam all exports funnel through, so it holds
// regardless of whether Phase 7 has populated a real key yet.
export function toExportableV2(v2: AppStoreV2): AppStoreV2 {
  return { ...v2, settings: { ...v2.settings, apiKey: "" } };
}

export interface BreakdownRow {
  label: string;
  done: number;
  total: number;
}

export function breakdownBy(
  problems: Problem[],
  getKey: (p: Problem) => string,
  order: string[],
  store: ProgressStore
): BreakdownRow[] {
  const stats: Record<string, { done: number; total: number }> = {};
  order.forEach((k) => (stats[k] = { done: 0, total: 0 }));
  problems.forEach((p) => {
    const k = getKey(p);
    if (!stats[k]) return;
    stats[k].total++;
    if (getState(store, p.id).done) stats[k].done++;
  });
  return order.filter((k) => stats[k].total > 0).map((k) => ({ label: k, ...stats[k] }));
}

export interface VisibilityContext {
  topicName: string;
  patternName: string;
}

export function isProblemVisible(
  problem: Problem,
  state: ProblemState,
  filters: FilterState,
  context: VisibilityContext
): boolean {
  const q = filters.search.trim().toLowerCase();
  const haystack = [problem.question, context.topicName, context.patternName, problem.subpattern, problem.platform]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matchesText = !q || haystack.includes(q);
  const matchesDiff = filters.difficulty === "All" || problem.difficulty === filters.difficulty;
  const matchesImportance = filters.importance === "All" || problem.importance === filters.importance;
  const matchesFreq = filters.freq === "All" || problem.interviewFreq === filters.freq;
  const matchesCompleted = !filters.hideCompleted || !state.done;
  const matchesRevise = !filters.reviseOnly || state.revise;
  return matchesText && matchesDiff && matchesImportance && matchesFreq && matchesCompleted && matchesRevise;
}

export function areFiltersActive(filters: FilterState): boolean {
  return (
    !!filters.search.trim() ||
    filters.difficulty !== "All" ||
    filters.importance !== "All" ||
    filters.freq !== "All" ||
    filters.reviseOnly
  );
}

// --- Dates -----------------------------------------------------------------

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

// --- Heatmap / streak / dashboard (pure logic) ------------------------------

export function buildHeatmapStats(store: ProgressStore) {
  const doneByDate = new Map<string, number>();
  const revisedByDate = new Map<string, number>();
  Object.values(store.problems).forEach((st) => {
    if (st.completedAt) doneByDate.set(st.completedAt, (doneByDate.get(st.completedAt) || 0) + 1);
    if (st.revisedAt) revisedByDate.set(st.revisedAt, (revisedByDate.get(st.revisedAt) || 0) + 1);
  });
  return { doneByDate, revisedByDate };
}

// Fixed thresholds rather than rebasing on the range max: a single solved problem
// shouldn't render as the darkest green, and two years should be comparable.
// A streak stays alive through today even before you've solved anything today —
// it only breaks once a full day passes with nothing solved.
export function computeStreak(doneByDate: Map<string, number>, now: Date = new Date()): number {
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!doneByDate.get(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (doneByDate.get(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// How many years back the record actually goes -- paging past it shows nothing.
export function earliestYearOffset(store: ProgressStore, now: Date = new Date()): number {
  const earliest = Object.values(store.problems)
    .map((st) => st.completedAt || st.revisedAt)
    .filter(Boolean)
    .sort()[0];
  return earliest ? now.getFullYear() - Number(earliest.slice(0, 4)) : 0;
}

export function findNextUnsolved<T extends { id: string }>(problems: T[], store: ProgressStore): T | null {
  return problems.find((p) => !getState(store, p.id).done) || null;
}

export function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (!count) return 0;
  if (count >= 10) return 4;
  if (count >= 6) return 3;
  if (count >= 3) return 2;
  return 1;
}

export function formatDayLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export interface HeatmapRange {
  start: Date;
  end: Date;
  label: string;
}

export function getHeatmapRange(offset: number, now: Date = new Date()): HeatmapRange {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (offset === 0) {
    const end = today;
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    return { start, end, label: "Current" };
  }
  const year = today.getFullYear() - offset;
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31), label: String(year) };
}

// Each month owns only its own days: a week straddling a month boundary is
// split, so no day ever renders under a neighbouring month's label.
export function buildHeatmapMonths(
  doneByDate: Map<string, number>,
  revisedByDate: Map<string, number>,
  range: HeatmapRange
): HeatmapMonth[] {
  const months: HeatmapMonth[] = [];
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const lastMonthStart = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  while (cursor <= lastMonthStart) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const from = monthStart < range.start ? new Date(range.start) : monthStart;
    const to = monthEnd > range.end ? new Date(range.end) : monthEnd;
    const days: HeatmapDay[] = [];
    for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      days.push({ date: new Date(d), done: doneByDate.get(iso) || 0, revised: revisedByDate.get(iso) || 0 });
    }
    if (days.length) months.push({ label: MONTH_NAMES[monthStart.getMonth()], pad: from.getDay(), days });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

// --- Merge --------------------------------------------------------------

// ISO dates sort lexically, so the earliest is just the smaller string.
export function earlierDate(a: string | null, b: string | null): string | null {
  if (a && b) return a < b ? a : b;
  return a || b || null;
}

export function mergeNotes(a: string, b: string): string {
  const left = (a || "").trim();
  const right = (b || "").trim();
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return `${left}\n\n--- merged ---\n\n${right}`;
}

// Union merge: a problem is solved if either copy says so, so merging can only
// ever add progress. Never un-solves anything and never drops a note.
export function mergeStores(local: ProgressStore, incoming: ProgressStore): ProgressStore {
  const merged: ProgressStore = { version: 1, problems: {}, idsMigrated: true };
  const ids = new Set([...Object.keys(local.problems), ...Object.keys(incoming.problems)]);
  ids.forEach((id) => {
    const a = local.problems[id] || ({} as Partial<ProblemState>);
    const b = incoming.problems[id] || ({} as Partial<ProblemState>);
    const done = !!(a.done || b.done);
    const revise = !!(a.revise || b.revise);
    merged.problems[id] = {
      done,
      revise,
      notes: mergeNotes(a.notes ?? "", b.notes ?? ""),
      // Keep the invariant the rest of the app relies on: no date without the flag.
      completedAt: done ? earlierDate(a.completedAt ?? null, b.completedAt ?? null) : null,
      revisedAt: revise ? earlierDate(a.revisedAt ?? null, b.revisedAt ?? null) : null,
    };
  });
  return merged;
}

// --- v2 (IndexedDB) adapter -------------------------------------------------
// Phase 2 moves persistence to IndexedDB without touching the UI layer yet
// (that's Phase 3). These two functions are the seam: the reducer and every
// component still see the familiar v1 ProgressStore shape, while what's
// actually saved to disk is v2. Round-tripping through here on every change
// must never clobber v2-only fields (approach/pseudocode/mistakes/etc.) that
// a later phase writes -- so patch existing entries, don't replace them.

export function v2ProgressToV1Store(v2: AppStoreV2): ProgressStore {
  const problems: Record<string, ProblemState> = {};
  for (const [id, p] of Object.entries(v2.progress)) {
    problems[id] = {
      done: p.completed,
      revise: p.starred,
      notes: p.notes.legacy,
      completedAt: p.lastCompletedAt,
      revisedAt: p.starredAt,
    };
  }
  return { version: 1, problems, idsMigrated: true };
}

// --- Completion gate (Phase 3) -----------------------------------------
// completionGateVersion stays `null` (grandfathered/ungated) for every
// migrated, pre-existing, requireEvidence-bypassed, or re-checked
// completion. It's stamped with this version only when a genuinely new
// completion actually satisfied the evidence rule below.
export const CURRENT_COMPLETION_GATE_VERSION = 1;

export function hasNotes(progress: QuestionProgressV2): boolean {
  return Object.values(progress.notes).some((v) => v.trim().length > 0);
}

export function hasCompletionEvidence(progress: QuestionProgressV2): boolean {
  return !!progress.pseudocode.trim() || !!progress.code.trim();
}

// A completion is free of the evidence gate if: the question has ever been
// completed before (grandfathered -- "editable but not re-gated", never
// retroactively invalidated), or the setting is off (the friction release
// valve), or evidence already exists.
export function canCompleteFreely(progress: QuestionProgressV2, settings: AppSettings): boolean {
  return progress.firstCompletedAt !== null || !settings.requireEvidence || hasCompletionEvidence(progress);
}

export function patchV2FromV1(v2: AppStoreV2, v1: ProgressStore): AppStoreV2 {
  const progress: Record<string, QuestionProgressV2> = { ...v2.progress };
  for (const [id, state] of Object.entries(v1.problems)) {
    const base = progress[id] ?? liftV1Entry(state);
    // Only a genuine false -> true transition is "a new completion". An
    // unrelated dispatch re-patching this id (already done, or still not
    // done) must never disturb what's already recorded for it.
    const justCompleted = state.done && !base.completed;
    // A gate-verified completion is one that's genuinely new (never
    // completed before -- grandfathered/re-checks are exempt) AND has real
    // evidence recorded at the moment of completion. Everything else --
    // grandfathered, requireEvidence off, re-checks -- stays ungated (0).
    const gateSatisfied = justCompleted && base.firstCompletedAt === null && hasCompletionEvidence(base);
    progress[id] = {
      ...base,
      completed: state.done,
      starred: state.revise,
      starredAt: state.revisedAt,
      // Immutable once set: the historical fact of the FIRST completion,
      // never replaced by a later re-completion. Un-checking does not clear
      // it either -- only ever set from null, never reset back to null.
      firstCompletedAt: base.firstCompletedAt ?? (state.done ? state.completedAt : null),
      // The most recent completion date. Updates only on a new completion;
      // un-checking leaves it as-is (the plan doesn't ask it to be cleared).
      lastCompletedAt: justCompleted ? state.completedAt : base.lastCompletedAt,
      completionGateVersion: justCompleted ? (gateSatisfied ? CURRENT_COMPLETION_GATE_VERSION : null) : base.completionGateVersion,
      notes: { ...base.notes, legacy: state.notes },
    };
  }
  return { ...v2, progress };
}

// --- v2-native writes (Phase 2 remediation) ---------------------------------
// Fields with no v1 equivalent (approach/pseudocode/code/structured notes/
// mistakes) can't be represented as a v1 Action, so they get their own
// reducer that patches v2 directly. patchV2FromV1 above never touches these
// fields (it always spreads `base` first), so a legacy v1 action can never
// clobber anything written here -- verified by tests in store.test.ts.

export function getV2Progress(v2: AppStoreV2, id: string): QuestionProgressV2 {
  return v2.progress[id] ?? liftV1Entry({ done: false, revise: false, notes: "", completedAt: null, revisedAt: null });
}

// A topic with no revision history yet (never crossed the threshold) has no
// entry in v2.revision at all -- this is its derived default, mirroring
// getV2Progress's same never-completed fallback below.
export function getTopicRevision(v2: AppStoreV2, topicId: string): TopicRevision {
  return (
    v2.revision[topicId] ?? {
      topicId,
      cycle: 0,
      nextDueAt: null,
      lastPassedAt: null,
      lastFailedAt: null,
      activeSessionId: null,
      history: [],
      weakConcepts: {},
    }
  );
}

// Plan §5's "schedule created" step, applied automatically the moment a
// topic's completion first crosses the threshold (fired from the same v1->v2
// sync effect that already runs on every store change). Only ever writes a
// topic that has NO existing revision entry -- once one exists (however it
// got there), it is never overwritten here, so this can't clobber real
// history/cycle/weakConcepts on a later re-check, and un-completing a
// question back below threshold never un-schedules it either.
export function ensureTopicsScheduled(v2: AppStoreV2, topics: Topic[], now: Date = new Date()): AppStoreV2 {
  let revision = v2.revision;
  for (const topic of topics) {
    if (revision[topic.id] || (REVISION_CONFIG.exemptTopics as readonly string[]).includes(topic.id)) continue;
    const problems = topic.patterns.flatMap((p) => p.problems);
    const done = problems.filter((p) => v2.progress[p.id]?.completed).length;
    const pct = problems.length ? done / problems.length : 0;
    if (pct < REVISION_CONFIG.completionThreshold) continue;
    revision = {
      ...revision,
      [topic.id]: {
        topicId: topic.id,
        cycle: 0,
        nextDueAt: scheduleInitial(now),
        lastPassedAt: null,
        lastFailedAt: null,
        activeSessionId: null,
        history: [],
        weakConcepts: {},
      },
    };
  }
  return revision === v2.revision ? v2 : { ...v2, revision };
}

function patchV2Progress(v2: AppStoreV2, id: string, patch: Partial<QuestionProgressV2>): AppStoreV2 {
  const existing = getV2Progress(v2, id);
  return { ...v2, progress: { ...v2.progress, [id]: { ...existing, ...patch } } };
}

export function v2Reducer(v2: AppStoreV2, action: V2Action): AppStoreV2 {
  switch (action.type) {
    case "SET_APPROACH":
      return patchV2Progress(v2, action.id, { approach: action.approach });
    case "SET_PSEUDOCODE":
      return patchV2Progress(v2, action.id, { pseudocode: action.pseudocode });
    case "SET_CODE":
      return patchV2Progress(v2, action.id, { code: action.code });
    case "SET_STRUCTURED_NOTE": {
      const existing = getV2Progress(v2, action.id);
      return patchV2Progress(v2, action.id, { notes: { ...existing.notes, [action.field]: action.value } });
    }
    case "ADD_MISTAKE": {
      const existing = getV2Progress(v2, action.id);
      return patchV2Progress(v2, action.id, { mistakes: [...existing.mistakes, action.mistake] });
    }
    case "REMOVE_MISTAKE": {
      const existing = getV2Progress(v2, action.id);
      return patchV2Progress(v2, action.id, { mistakes: existing.mistakes.filter((m) => m.at !== action.at) });
    }
    case "REPLACE_STORE":
      return action.store;

    // --- Phase 6: revision session lifecycle ---------------------------
    case "START_REVISION_SESSION": {
      const tr = getTopicRevision(v2, action.topicId);
      return {
        ...v2,
        attempts: { ...v2.attempts, [action.attempt.id]: action.attempt },
        revision: { ...v2.revision, [action.topicId]: { ...tr, activeSessionId: action.attempt.id } },
      };
    }
    case "SAVE_FUNDAMENTAL_ANSWER": {
      const attempt = v2.attempts[action.attemptId];
      if (!attempt) return v2;
      return {
        ...v2,
        attempts: {
          ...v2.attempts,
          [action.attemptId]: {
            ...attempt,
            fundamentals: attempt.fundamentals.map((f) =>
              f.conceptId === action.conceptId ? { ...f, answer: action.answer } : f
            ),
          },
        },
      };
    }
    case "SAVE_QUESTION_RECALL": {
      const attempt = v2.attempts[action.attemptId];
      if (!attempt) return v2;
      return {
        ...v2,
        attempts: {
          ...v2.attempts,
          [action.attemptId]: {
            ...attempt,
            questions: attempt.questions.map((q) =>
              q.questionId === action.questionId ? { ...q, [action.field]: action.value } : q
            ),
          },
        },
      };
    }
    case "SAVE_QUESTION_CONFIDENCE": {
      const attempt = v2.attempts[action.attemptId];
      if (!attempt) return v2;
      return {
        ...v2,
        attempts: {
          ...v2.attempts,
          [action.attemptId]: {
            ...attempt,
            questions: attempt.questions.map((q) =>
              q.questionId === action.questionId ? { ...q, confidence: action.confidence } : q
            ),
          },
        },
      };
    }
    case "SUBMIT_REVISION_SESSION": {
      const attempt = v2.attempts[action.attemptId];
      if (!attempt) return v2;
      const nowIso = todayISO();
      // Confidence is learning data, never a score (plan §8) -- submitting
      // records that a real revision happened (count/lastRevisedAt/
      // lastConfidence) but never touches lastScore or TopicRevision's
      // cycle/history, since neither can exist without a real evaluation
      // (Phase 7). The topic stays exactly as gated as it was.
      let progress = v2.progress;
      for (const q of attempt.questions) {
        if (!q.confidence) continue;
        const existing = getV2Progress(v2, q.questionId);
        progress = {
          ...progress,
          [q.questionId]: {
            ...existing,
            revisionStats: {
              ...existing.revisionStats,
              count: existing.revisionStats.count + 1,
              lastRevisedAt: nowIso,
              lastConfidence: q.confidence,
            },
          },
        };
      }
      const tr = getTopicRevision(v2, attempt.topicId);
      return {
        ...v2,
        progress,
        attempts: {
          ...v2.attempts,
          [action.attemptId]: { ...attempt, submittedAt: new Date().toISOString(), evaluationStatus: "PENDING" },
        },
        revision: { ...v2.revision, [attempt.topicId]: { ...tr, activeSessionId: null } },
      };
    }

    // --- Phase 7: LLM evaluation ---------------------------------------
    case "SET_SETTINGS":
      return { ...v2, settings: { ...v2.settings, ...action.patch } };

    case "SET_ATTEMPT_ERROR": {
      const attempt = v2.attempts[action.attemptId];
      if (!attempt) return v2;
      // evaluationStatus is untouched: a failed evaluation stays PENDING and
      // retryable, and the topic stays exactly as gated as it already was --
      // not passed, not failed (plan §9).
      return { ...v2, attempts: { ...v2.attempts, [action.attemptId]: { ...attempt, error: action.error } } };
    }

    case "APPLY_EVALUATION":
      return applyEvaluation(v2, action.attemptId, action.evaluation);
  }
}

// Exported for direct testing: this is the one place a revision actually
// passes or fails, so it gets tested without going through a reducer call.
export function applyEvaluation(v2: AppStoreV2, attemptId: string, evaluation: EvaluationResult): AppStoreV2 {
  const attempt = v2.attempts[attemptId];
  if (!attempt) return v2;

  const scored = scoreEvaluation(attempt, evaluation);
  // Incomplete grading is not a failing grade. Leave the attempt PENDING with
  // an error so it can be retried, and don't touch the schedule.
  if (!scored) {
    return {
      ...v2,
      attempts: {
        ...v2.attempts,
        [attemptId]: { ...attempt, error: "The evaluation didn't cover every question. Try again." },
      },
    };
  }

  const { scoring, questionScores } = scored;

  // Per-question score is real data now, so revisionStats.lastScore stops
  // being null and starts feeding selection.ts's weighting.
  let progress = v2.progress;
  for (const [questionId, score] of Object.entries(questionScores)) {
    const existing = getV2Progress(v2, questionId);
    progress = {
      ...progress,
      [questionId]: { ...existing, revisionStats: { ...existing.revisionStats, lastScore: score } },
    };
  }

  // Phase 4's scheduler owns the interval advance: pass -> cycle++ and a new
  // nextDueAt (which is what finally un-gates the topic), fail -> unchanged
  // and still due, weak concepts recorded either way.
  const revision = {
    ...v2.revision,
    [attempt.topicId]: recordAttemptOutcome(getTopicRevision(v2, attempt.topicId), {
      passed: scoring.passed,
      score: scoring.overallScore,
      attemptId,
      weakConceptIds: scoring.weakConceptIds,
    }),
  };

  return {
    ...v2,
    progress,
    revision,
    attempts: {
      ...v2.attempts,
      [attemptId]: { ...attempt, evaluationStatus: "OK", evaluation, error: null },
    },
  };
}

export interface MergeSummary {
  newlySolved: number;
  newlyRevised: number;
  notesCombined: number;
}

export function summarizeMerge(local: ProgressStore, merged: ProgressStore): MergeSummary {
  let newlySolved = 0;
  let newlyRevised = 0;
  let notesCombined = 0;
  Object.keys(merged.problems).forEach((id) => {
    const before = local.problems[id] || ({} as Partial<ProblemState>);
    const after = merged.problems[id];
    if (after.done && !before.done) newlySolved++;
    if (after.revise && !before.revise) newlyRevised++;
    if (after.notes && after.notes !== (before.notes || "")) notesCombined++;
  });
  return { newlySolved, newlyRevised, notesCombined };
}
