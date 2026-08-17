import idMapRaw from "../../data/idMap.json";
import type { AppSettings, AppStoreV2, ProblemState, ProgressStore, QuestionProgressV2 } from "../types";

const ID_MAP: Record<string, string> = idMapRaw;

export const DEFAULT_SETTINGS: AppSettings = {
  requireEvidence: true,
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
  return result;
}
