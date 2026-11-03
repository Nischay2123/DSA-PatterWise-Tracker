// Sync storage: one file in a secret GitHub Gist on the user's own account,
// read and written straight from the browser with their token. No server of
// ours is involved. `fetchFn` is injected so tests can stand in for GitHub.

export const SYNC_FILE = "dsa-tracker-sync.json";
const DESCRIPTION = "DSA Tracker progress — synced between your devices by the app. Don't edit by hand.";
const API = "https://api.github.com";

export type SyncErrorCode = "bad-token" | "no-permission" | "rate-limited" | "offline" | "bad-file" | "not-found" | "unknown";

export const SYNC_ERROR_MESSAGE: Record<SyncErrorCode, string> = {
  "bad-token": "GitHub rejected the token — it may be mistyped, expired or revoked.",
  "no-permission": "The token can't use gists. Create one with the gist scope (or Gists: read and write).",
  "rate-limited": "GitHub's rate limit was hit. Sync will retry later.",
  offline: "Couldn't reach GitHub — you may be offline. Sync will retry when you're back.",
  "bad-file": "The sync file in your gist isn't readable progress, so nothing was changed. Delete that gist and sync again.",
  "not-found": "The sync gist is gone.",
  unknown: "Sync failed for an unexpected reason.",
};

export class SyncError extends Error {
  constructor(public code: SyncErrorCode) {
    super(SYNC_ERROR_MESSAGE[code]);
  }
}

type Fetch = typeof fetch;

async function gh<T>(fetchFn: Fetch, token: string, path: string, init?: { method: string; body: string }): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(API + path, {
      method: init?.method ?? "GET",
      body: init?.body,
      // GitHub sends max-age=60; a cached read would merge a minute-old copy.
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.body && { "Content-Type": "application/json" }),
      },
    });
  } catch {
    throw new SyncError("offline");
  }
  if (res.ok) return (await res.json()) as T;
  if (res.status === 401) throw new SyncError("bad-token");
  if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) {
    throw new SyncError("rate-limited");
  }
  if (res.status === 403) throw new SyncError("no-permission");
  if (res.status === 404) throw new SyncError("not-found");
  throw new SyncError("unknown");
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface Gist {
  id: string;
  files: Record<string, GistFile>;
}

/** The gist holding the sync file, found by its file name; null if there is none yet. */
export async function findSyncGist(fetchFn: Fetch, token: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const list = await gh<Gist[]>(fetchFn, token, `/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.files && SYNC_FILE in g.files);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return null;
}

export async function createSyncGist(fetchFn: Fetch, token: string, content: string): Promise<string> {
  const gist = await gh<Gist>(fetchFn, token, "/gists", {
    method: "POST",
    body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [SYNC_FILE]: { content } } }),
  });
  return gist.id;
}

/** The sync file's text, or null if the gist no longer has one. */
export async function readSyncGist(fetchFn: Fetch, token: string, id: string): Promise<string | null> {
  const gist = await gh<Gist>(fetchFn, token, `/gists/${id}`);
  const file = gist.files?.[SYNC_FILE];
  if (!file) return null;
  if (!file.truncated) return file.content ?? "";
  // The API inlines up to 1 MB; past that the file is fetched whole from its raw URL.
  try {
    const res = await fetchFn(file.raw_url!, { cache: "no-store" });
    if (res.ok) return await res.text();
  } catch {
    // fall through
  }
  throw new SyncError("offline");
}

export async function writeSyncGist(fetchFn: Fetch, token: string, id: string, content: string): Promise<void> {
  await gh(fetchFn, token, `/gists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ files: { [SYNC_FILE]: { content } } }),
  });
}

export const gistUrl = (id: string) => `https://gist.github.com/${id}`;
