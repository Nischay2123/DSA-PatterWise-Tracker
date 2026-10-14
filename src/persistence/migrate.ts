import idMapRaw from "../../data/idMap.json";
import movedIdsRaw from "../../data/movedIds.json";
import type { AppSettings, AppStoreV2, ProblemState, ProgressStore, QuestionProgressV2 } from "../types";

const ID_MAP: Record<string, string> = idMapRaw;

// Problems moved to a better pattern after release. An id carries its pattern, so a move renames
// it; anything written before the move still says the old id. Append-only, like idMap.json.
export const MOVED_IDS: Record<string, string> = movedIdsRaw;
const renamed = (id: string) => MOVED_IDS[id] ?? id;

// Re-keys a v2 store written before a move: progress, and the question ids inside revision
// attempts. Returns the same object when nothing moved, so callers can tell whether to save.
// If both the old and new id hold progress, the new one stays and the old goes to
// orphanedProgress -- never overwritten, never dropped.
export function renameMovedIds(store: AppStoreV2): AppStoreV2 {
  const attempts = Object.values(store.attempts);
  const stale =
    Object.keys(store.progress).some((id) => id in MOVED_IDS) ||
    attempts.some(
      (a) =>
        a?.questions?.some((q) => q.questionId in MOVED_IDS) ||
        a?.evaluation?.perQuestion?.some((q) => q.questionId in MOVED_IDS)
    );
  if (!stale) return store;

  const progress: Record<string, QuestionProgressV2> = {};
  const orphanedProgress = { ...store.orphanedProgress };
  const entries = Object.entries(store.progress);
  for (const [id, entry] of entries) if (!(id in MOVED_IDS)) progress[id] = entry;
  for (const [id, entry] of entries) {
    if (!(id in MOVED_IDS)) continue;
    if (progress[MOVED_IDS[id]]) orphanedProgress[id] = entry;
    else progress[MOVED_IDS[id]] = entry;
  }

  const fixAttempts: AppStoreV2["attempts"] = {};
  for (const [key, a] of Object.entries(store.attempts)) {
    fixAttempts[key] = !a
      ? a
      : {
          ...a,
          questions: a.questions?.map((q) => ({ ...q, questionId: renamed(q.questionId) })),
          evaluation: a.evaluation && {
            ...a.evaluation,
            perQuestion: a.evaluation.perQuestion?.map((q) => ({ ...q, questionId: renamed(q.questionId) })),
          },
        };
  }
  return { ...store, progress, orphanedProgress, attempts: fixAttempts };
}

// The v1 shape of the same rename. A collision keeps the entry already under the new id.
export function renameMovedIdsV1(problems: Record<string, ProblemState>): Record<string, ProblemState> {
  if (!Object.keys(problems).some((id) => id in MOVED_IDS)) return problems;
  const out: Record<string, ProblemState> = {};
  for (const [id, state] of Object.entries(problems)) if (!(id in MOVED_IDS)) out[id] = state;
  for (const [id, state] of Object.entries(problems)) if (id in MOVED_IDS && !out[MOVED_IDS[id]]) out[MOVED_IDS[id]] = state;
  return out;
}

export const DEFAULT_SETTINGS: AppSettings = {
  requireEvidence: true,
  gateOnRevisionDue: true,
  llmEnabled: false,
  theme: "system",
  provider: "gemini",
  model: "",
  apiKey: "",
};

export function emptyAppStoreV2(): AppStoreV2 {
  return {
    schemaVersion: 2,
    progress: {},
    revision: {},
    attempts: {},
    settings: { ...DEFAULT_SETTINGS },
    orphanedProgress: {},
  };
}

// Preserve real dates -- only null when genuinely absent, never fabricated or discarded.
// v1 `revisedAt` is a star (bookmark) date, not evidence of a real revision, so it
// maps to `starredAt` and never touches `revisionStats.lastRevisedAt`.
export function liftV1Entry(v1: ProblemState): QuestionProgressV2 {
  return {
    completed: v1.done,
    starred: v1.revise,
    starredAt: v1.revisedAt ?? null,
    firstCompletedAt: v1.completedAt ?? null,
    lastCompletedAt: v1.completedAt ?? null,
    // Every migrated entry predates Phase 3's completion-evidence gate by
    // definition -- grandfathered, not subject to it.
    completionGateVersion: null,
    // Nothing migrated was ever graded; grading postdates every v1 entry.
    gradedAt: null,
    approach: "",
    pseudocode: "",
    code: "",
    notes: {
      legacy: v1.notes ?? "",
      approach: "",
      keyInsight: "",
      commonMistake: "",
      complexity: "",
      edgeCases: "",
      reminder: "",
    },
    mistakes: [],
    revisionStats: { count: 0, lastRevisedAt: null, lastScore: null, lastConfidence: null },
  };
}

// Structural validation for whatever idb-keyval hands back. Guards against a
// corrupted or partially-written record that happens to carry schemaVersion 2
// but isn't actually shaped like an AppStoreV2 -- db.ts treats "invalid" the
// same as "missing" rather than trusting it blindly.
export function isValidAppStoreV2(parsed: unknown): parsed is AppStoreV2 {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  const isPlainRecord = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  return (
    p.schemaVersion === 2 &&
    isPlainRecord(p.progress) &&
    isPlainRecord(p.revision) &&
    isPlainRecord(p.attempts) &&
    isPlainRecord(p.settings) &&
    isPlainRecord(p.orphanedProgress)
  );
}

// Pure v1 -> v2 mapping. Never touches localStorage/IDB -- callers own I/O and backups.
export function migrateV1ToV2(v1: ProgressStore | null | undefined): AppStoreV2 {
  const result = emptyAppStoreV2();
  if (!v1 || !v1.problems || typeof v1.problems !== "object") return result;

  for (const [key, state] of Object.entries(v1.problems)) {
    if (!state) continue;
    // Already-migrated vanilla stores use stable ids as keys directly; only
    // consult idMap.json (the frozen p1..p467 bridge) when that hasn't happened.
    const stableId = v1.idsMigrated ? key : ID_MAP[key];
    if (stableId) {
      result.progress[stableId] = liftV1Entry(state);
    } else {
      result.orphanedProgress[key] = liftV1Entry(state);
    }
  }
  return renameMovedIds(result);
}
