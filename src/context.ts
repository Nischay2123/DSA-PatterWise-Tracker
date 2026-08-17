import type { Dispatch, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import { loadAppStore, saveAppStore } from "./persistence/db";
import { emptyAppStoreV2 } from "./persistence/migrate";
import { getState, patchV2FromV1, todayISO, v2ProgressToV1Store } from "./store";
import type { AppStoreV2, FilterState, ProblemState, ProgressStore } from "./types";

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
  const [importNonce, setImportNonce] = useState(0);
  const [status, setStatus] = useState<BootStatus>("loading");
  const [bootError, setBootError] = useState<string | null>(null);
  const v2Ref = useRef<AppStoreV2>(emptyAppStoreV2());
  const bootedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadAppStore()
      .then((v2) => {
        if (cancelled) return;
        v2Ref.current = v2;
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
    v2Ref.current = patchV2FromV1(v2Ref.current, store);
    saveAppStore(v2Ref.current);
  }, [store]);

  const wrappedDispatch = useCallback((action: Action) => {
    if (action.type === "IMPORT") setImportNonce((n) => n + 1);
    dispatch(action);
  }, []);

  return { store, dispatch: wrappedDispatch, importNonce, status, bootError };
}

interface StoreContextValue {
  store: ProgressStore;
  dispatch: (action: Action) => void;
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
