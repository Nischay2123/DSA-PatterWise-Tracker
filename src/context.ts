import type { Dispatch, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useReducer, useState } from "react";
import { getState, loadStore, saveStore, todayISO } from "./store";
import type { FilterState, ProblemState, ProgressStore } from "./types";

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

export function useProgressStore() {
  const [store, dispatch] = useReducer(storeReducer, undefined, () => loadStore());
  const [importNonce, setImportNonce] = useState(0);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const wrappedDispatch = useCallback((action: Action) => {
    if (action.type === "IMPORT") setImportNonce((n) => n + 1);
    dispatch(action);
  }, []);

  return { store, dispatch: wrappedDispatch, importNonce };
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
