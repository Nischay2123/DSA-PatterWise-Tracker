import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AppStoreV2 } from "../types";
import { createSyncGist, findSyncGist, readSyncGist, SyncError, writeSyncGist, type SyncErrorCode } from "./gist";
import { planSync } from "./plan";

// Keeps this device and the sync gist in step: on open, a few seconds after a
// change, when the tab comes back into view and when the network returns.
//
// The token lives only in this browser's localStorage, never in the progress
// store, so it can't end up in an export or in the gist itself.

const CONFIG_KEY = "dsa-tracker-gist-sync";
const DEBOUNCE_MS = 4000;
const RETRY_MS = 5000;

interface SyncConfig {
  token: string;
  gistId: string | null;
  lastSyncedAt: string | null;
}

function loadConfig(): SyncConfig | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "null");
    return parsed && typeof parsed.token === "string" && parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

function saveConfig(config: SyncConfig | null): void {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // Storage blocked: sync still works for this visit, it just isn't remembered.
  }
}

export interface SyncApi {
  configured: boolean;
  syncing: boolean;
  error: SyncErrorCode | null;
  lastSyncedAt: string | null;
  gistId: string | null;
  /** Saves the token and runs a first sync; resolves to the error, if any. */
  connect: (token: string) => Promise<SyncErrorCode | null>;
  /** Forgets the token on this device. The gist is left alone. */
  disconnect: () => void;
  syncNow: () => void;
}

/** Applying a merge rebuilds the problem list, which would throw away text being typed. */
const typing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "checkbox"));
};

export function useGistSync({
  ready,
  v2Store,
  apply,
}: {
  ready: boolean;
  v2Store: AppStoreV2;
  apply: (store: AppStoreV2) => void;
}): SyncApi {
  const [config, setConfig] = useState<SyncConfig | null>(loadConfig);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<SyncErrorCode | null>(null);

  const latest = useRef(v2Store);
  latest.current = v2Store;
  const configRef = useRef(config);
  configRef.current = config;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const inFlight = useRef<Promise<SyncErrorCode | null> | null>(null);
  const again = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `run` and `sync` call each other; the ref breaks the declaration cycle.
  const syncRef = useRef<() => Promise<SyncErrorCode | null>>(async () => null);
  const sync = () => syncRef.current();

  const updateConfig = (next: SyncConfig | null) => {
    configRef.current = next;
    setConfig(next);
    saveConfig(next);
  };

  const run = useCallback(async (): Promise<SyncErrorCode | null> => {
    const cfg = configRef.current;
    if (!cfg) return null;
    setSyncing(true);
    try {
      let gistId = cfg.gistId ?? (await findSyncGist(fetch, cfg.token));
      let remoteText: string | null = null;
      if (gistId) {
        try {
          remoteText = await readSyncGist(fetch, cfg.token, gistId);
        } catch (e) {
          // Deleted on GitHub: start a fresh one from this device below.
          if (!(e instanceof SyncError && e.code === "not-found")) throw e;
          gistId = null;
        }
      }
      // Planned after the network wait, against the store as it is now, so a
      // change made mid-sync is merged rather than overwritten.
      const plan = planSync(latest.current, remoteText);
      // Applied before the upload's network wait: applying afterwards would
      // overwrite anything changed during that wait with this older merge.
      if (plan.applyLocal) {
        if (!typing()) applyRef.current(plan.merged);
        else {
          // Retried, re-merged against the store as it is then, once the text
          // box is left -- on focusout, and every few seconds in case that
          // event never comes.
          again.current = true;
          if (retry.current) clearTimeout(retry.current);
          retry.current = setTimeout(() => void sync(), RETRY_MS);
        }
      }
      if (!gistId) gistId = await createSyncGist(fetch, cfg.token, plan.upload);
      else if (plan.push) await writeSyncGist(fetch, cfg.token, gistId, plan.upload);
      if (configRef.current) updateConfig({ ...configRef.current, gistId, lastSyncedAt: new Date().toISOString() });
      setError(null);
      return null;
    } catch (e) {
      const code = e instanceof SyncError ? e.code : "unknown";
      setError(code);
      return code;
    } finally {
      setSyncing(false);
    }
  }, []);

  // One round at a time; a request during a round queues exactly one more.
  syncRef.current = (): Promise<SyncErrorCode | null> => {
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const round = run().finally(() => {
      inFlight.current = null;
      if (again.current && !typing()) {
        again.current = false;
        void sync();
      }
    });
    inFlight.current = round;
    return round;
  };

  const configured = !!config;

  // On open, and once connected.
  useEffect(() => {
    if (ready && configured) void sync();
  }, [ready, configured]); // eslint-disable-line react-hooks/exhaustive-deps

  // A few seconds after any change. The first run is the boot load itself.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const booted = useRef(false);
  useEffect(() => {
    if (!ready || !configured) return;
    if (!booted.current) {
      booted.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void sync();
    }, DEBOUNCE_MS);
  }, [v2Store, ready, configured]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back in view (the phone reopening the tab), leaving the tab (push what's
  // pending now, before the browser freezes it), the network returning, and
  // leaving a text box while a merge waited for it.
  useEffect(() => {
    if (!ready || !configured) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") return void sync();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void sync();
      }
    };
    const onOnline = () => void sync();
    const onFocusOut = () => {
      if (again.current && !inFlight.current) setTimeout(() => !typing() && again.current && sync(), 0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [ready, configured]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async (token: string) => {
    updateConfig({ token: token.trim(), gistId: null, lastSyncedAt: null });
    const err = await sync();
    // A token that can't work isn't kept; anything else (offline) retries later.
    if (err === "bad-token" || err === "no-permission") updateConfig(null);
    return err;
  };

  const disconnect = () => {
    if (timer.current) clearTimeout(timer.current);
    if (retry.current) clearTimeout(retry.current);
    updateConfig(null);
    setError(null);
  };

  return {
    configured,
    syncing,
    error,
    lastSyncedAt: config?.lastSyncedAt ?? null,
    gistId: config?.gistId ?? null,
    connect,
    disconnect,
    syncNow: () => void sync(),
  };
}

export const SyncContext = createContext<SyncApi | null>(null);

export function useSync(): SyncApi {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncContext.Provider");
  return ctx;
}
