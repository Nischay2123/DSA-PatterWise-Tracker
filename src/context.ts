import type { Dispatch, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import questionsData from "../data/questions.json";
import { loadAppStore, saveAppStore } from "./persistence/db";
import { emptyAppStoreV2 } from "./persistence/migrate";
import { ensureTopicsScheduled, getState, patchV2FromV1, todayISO, v2ProgressToV1Store, v2Reducer } from "./store";
import type { AppStoreV2, FilterState, ProblemState, ProgressStore, QuestionData, V2Action } from "./types";

const ALL_TOPICS = (questionsData as QuestionData).topics;

export type Action =
  | { type: "TOGGLE_DONE"; id: string; done: boolean }
  | { type: "TOGGLE_REVISE"; id: string }
  | { type: "SET_NOTES"; id: string; notes: string }
  | { type: "IMPORT"; store: ProgressStore };

function patchProblem(store: ProgressStore, id: string, patch: Partial<ProblemState>): ProgressStore {
  return { ...store, problems: { ...store.problems, [id]: { ...getState(store, id), ...patch } } };
}

function storeReducer(store: ProgressStore, action: Action): ProgressStore {
  switch (action.type) {
    case "TOGGLE_DONE":
      return patchProblem(store, action.id, { done: action.done, completedAt: action.done ? todayISO() : null });
    case "TOGGLE_REVISE": {
      const revise = !getState(store, action.id).revise;
      return patchProblem(store, action.id, { revise, revisedAt: revise ? todayISO() : null });
    }
    case "SET_NOTES":
      return patchProblem(store, action.id, { notes: action.notes });
    case "IMPORT":
      return action.store;
  }
}

export type BootStatus = "loading" | "ready" | "error";

const EMPTY_STORE: ProgressStore = { version: 1, problems: {}, idsMigrated: true };

export function useProgressStore() {
  const [store, dispatch] = useReducer(storeReducer, EMPTY_STORE);
  const [v2Store, setV2Store] = useState<AppStoreV2>(() => emptyAppStoreV2());
  const [importNonce, setImportNonce] = useState(0);
  const [status, setStatus] = useState<BootStatus>("loading");
  const [bootError, setBootError] = useState<string | null>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadAppStore()
      .then((v2) => {
        if (cancelled) return;
        setV2Store(v2);
        dispatch({ type: "IMPORT", store: v2ProgressToV1Store(v2) });
        bootedRef.current = true;
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setBootError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Skip the placeholder pre-boot state and never persist while booted-with-error.
    if (!bootedRef.current) return;
    setV2Store((prev) => {
      // Plan §5's "schedule created" step: the moment a topic's completion
      // crosses the threshold, it gets a real nextDueAt (a grace period)
      // instead of jumping straight to REVISION_DUE the instant this ships
      // for anyone already above threshold. Runs on every store change but
      // is a no-op for every topic that already has a revision entry.
      const next = ensureTopicsScheduled(patchV2FromV1(prev, store), ALL_TOPICS);
      saveAppStore(next);
      return next;
    });
  }, [store]);

  const wrappedDispatch = useCallback((action: Action) => {
    if (action.type === "IMPORT") setImportNonce((n) => n + 1);
    dispatch(action);
  }, []);

  // Writes v2-only fields (approach/pseudocode/code/structured notes/mistakes)
  // directly, bypassing the v1 reducer entirely -- there's no v1 shape that
  // could carry them. Phase 3's UI is what will call this; nothing does yet.
  const dispatchV2 = useCallback((action: V2Action) => {
    setV2Store((prev) => {
      const next = v2Reducer(prev, action);
      saveAppStore(next);
      return next;
    });
  }, []);

  return { store, dispatch: wrappedDispatch, importNonce, status, bootError, v2Store, dispatchV2 };
}

interface StoreContextValue {
  store: ProgressStore;
  dispatch: (action: Action) => void;
  v2Store: AppStoreV2;
  dispatchV2: (action: V2Action) => void;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreContext.Provider");
  return ctx;
}

interface FiltersContextValue {
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
}

export const FiltersContext = createContext<FiltersContextValue | null>(null);

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersContext.Provider");
  return ctx;
}
