import { describe, expect, it, vi } from "vitest";
import { createSyncGist, findSyncGist, readSyncGist, SYNC_FILE, writeSyncGist } from "./gist";

// A pocket GitHub: just enough of the gists API for these calls.
function fakeGitHub({ token = "good", extraGists = 0 } = {}) {
  const gists = new Map<string, Record<string, { content: string }>>();
  for (let i = 0; i < extraGists; i++) gists.set(`other${i}`, { "notes.md": { content: "x" } });
  let next = 1;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (headers.Authorization !== `Bearer ${token}`) return json({ message: "Bad credentials" }, 401);
    const { pathname, searchParams } = new URL(url);
    const method = init?.method ?? "GET";
    if (pathname === "/gists" && method === "GET") {
      const page = Number(searchParams.get("page")), per = Number(searchParams.get("per_page"));
      const all = [...gists].map(([id, files]) => ({ id, files }));
      return json(all.slice((page - 1) * per, page * per));
    }
    if (pathname === "/gists" && method === "POST") {
      const body = JSON.parse(String(init!.body));
      const id = `g${next++}`;
      gists.set(id, body.files);
      return json({ id, files: body.files, public: body.public }, 201);
    }
    const id = pathname.split("/")[2];
    if (!gists.has(id)) return json({ message: "Not Found" }, 404);
    if (method === "PATCH") {
      Object.assign(gists.get(id)!, JSON.parse(String(init!.body)).files);
      return json({ id });
    }
    return json({ id, files: gists.get(id) });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls: fetchFn.mock.calls, gists };
}

describe("gist sync storage", () => {
  it("creates a secret gist, finds it again by file name across pages, reads and writes it", async () => {
    const gh = fakeGitHub({ extraGists: 150 });
    expect(await findSyncGist(gh.fetchFn, "good")).toBeNull();
    const id = await createSyncGist(gh.fetchFn, "good", '{"v":1}');
    const post = gh.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body)).public).toBe(false);
    expect(await findSyncGist(gh.fetchFn, "good")).toBe(id); // sits on page 2
    expect(await readSyncGist(gh.fetchFn, "good", id)).toBe('{"v":1}');
    await writeSyncGist(gh.fetchFn, "good", id, '{"v":2}');
    expect(await readSyncGist(gh.fetchFn, "good", id)).toBe('{"v":2}');
  });

  it("never reads from the HTTP cache", async () => {
    const gh = fakeGitHub();
    await findSyncGist(gh.fetchFn, "good");
    expect(gh.calls.every(([, init]) => init?.cache === "no-store")).toBe(true);
  });

  it("reads a large file whole from its raw URL", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith("/gists/big")
        ? new Response(JSON.stringify({ id: "big", files: { [SYNC_FILE]: { truncated: true, content: "{", raw_url: "https://raw.example/big" } } }))
        : new Response('{"whole":true}')
    ) as unknown as typeof fetch;
    expect(await readSyncGist(fetchFn, "t", "big")).toBe('{"whole":true}');
  });

  it("names what went wrong", async () => {
    const respond = (status: number, headers: Record<string, string> = {}) =>
      (async () => new Response("{}", { status, headers })) as unknown as typeof fetch;
    await expect(findSyncGist(fakeGitHub().fetchFn, "wrong")).rejects.toMatchObject({ code: "bad-token" });
    await expect(findSyncGist(respond(403, { "x-ratelimit-remaining": "0" }), "t")).rejects.toMatchObject({ code: "rate-limited" });
    await expect(findSyncGist(respond(403), "t")).rejects.toMatchObject({ code: "no-permission" });
    await expect(readSyncGist(respond(404), "t", "gone")).rejects.toMatchObject({ code: "not-found" });
    await expect(findSyncGist((async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch, "t")).rejects.toMatchObject({ code: "offline" });
  });
});
