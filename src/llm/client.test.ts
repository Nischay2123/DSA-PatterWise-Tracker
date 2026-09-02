import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluate, validateKey } from "./client";
import { getProvider, resolveModel } from "./providers";

// §13's failure cases, plus the plan's §9 client contract: 20s timeout, one
// retry on 5xx/network, never on 4xx, and codes-not-upstream-text on the way
// out. fetch is stubbed -- no network is touched by these tests.

const GOOD_EVALUATION = {
  passed: true,
  score: 80,
  perFundamental: [{ conceptId: "c1", score: 4, missing: [], note: "" }],
  perQuestion: [{ questionId: "q1", correctness: 4, approach: 4, pseudocode: 4, complexity: 4, mistakes: [], note: "" }],
  weakConcepts: [],
  feedback: "",
  recommendedFocus: [],
};

function geminiBody(text: string) {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] });
}

function stubFetch(...responses: (Response | Error)[]) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockImplementationOnce(() => Promise.reject(r));
    else fn.mockImplementationOnce(() => Promise.resolve(r));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

function res(status: number, body: string): Response {
  return new Response(body, { status });
}

const OPTS = { apiKey: "test-key", provider: "gemini", model: "", prompt: "grade this" };

afterEach(() => vi.unstubAllGlobals());

describe("evaluate -- success", () => {
  it("returns the validated evaluation", async () => {
    stubFetch(res(200, geminiBody(JSON.stringify(GOOD_EVALUATION))));
    const result = await evaluate(OPTS);
    expect(result).toEqual({ ok: true, data: GOOD_EVALUATION });
  });

  it("survives a model that wraps its JSON in a fence", async () => {
    stubFetch(res(200, geminiBody("```json\n" + JSON.stringify(GOOD_EVALUATION) + "\n```")));
    const result = await evaluate(OPTS);
    expect(result.ok).toBe(true);
  });
});

describe("evaluate -- key handling", () => {
  it("returns NO_KEY without making any request", async () => {
    const fetchFn = stubFetch(res(200, "{}"));
    const result = await evaluate({ ...OPTS, apiKey: "   " });
    expect(result).toEqual({ ok: false, error: "NO_KEY" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("maps Gemini's real bad-key shape (HTTP 400 + API_KEY_INVALID) to BAD_KEY", async () => {
    // Body copied from the live probe run in Phase 7 Step 0.
    stubFetch(res(400, JSON.stringify({ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } })));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "BAD_KEY" });
  });

  it("maps xAI's real bad-key shape to BAD_KEY", async () => {
    stubFetch(res(400, JSON.stringify({ code: "invalid-argument", error: "Incorrect API key provided." })));
    expect(await evaluate({ ...OPTS, provider: "grok" })).toEqual({ ok: false, error: "BAD_KEY" });
  });

  it("maps 403 (referrer-restricted key) to BAD_KEY", async () => {
    stubFetch(res(403, JSON.stringify({ error: { status: "PERMISSION_DENIED" } })));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "BAD_KEY" });
  });

  it("never puts the key in the URL", async () => {
    const fetchFn = stubFetch(res(200, geminiBody(JSON.stringify(GOOD_EVALUATION))));
    await evaluate({ ...OPTS, apiKey: "super-secret-key" });
    expect(String(fetchFn.mock.calls[0][0])).not.toContain("super-secret-key");
  });

  it("sends the key as a header instead", async () => {
    const fetchFn = stubFetch(res(200, geminiBody(JSON.stringify(GOOD_EVALUATION))));
    await evaluate({ ...OPTS, apiKey: "super-secret-key" });
    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("super-secret-key");
  });

  it("never leaks the key or upstream text into the returned error", async () => {
    stubFetch(res(400, "your key super-secret-key is invalid"));
    const result = await evaluate({ ...OPTS, apiKey: "super-secret-key" });
    expect(JSON.stringify(result)).not.toContain("super-secret-key");
    expect(JSON.stringify(result)).not.toContain("is invalid");
  });
});

describe("evaluate -- quota and upstream failures", () => {
  it("maps 429 to RATE_LIMIT (quota exhausted)", async () => {
    stubFetch(res(429, "{}"));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "RATE_LIMIT" });
  });

  it("does not retry a 4xx", async () => {
    const fetchFn = stubFetch(res(429, "{}"), res(200, geminiBody(JSON.stringify(GOOD_EVALUATION))));
    await evaluate(OPTS);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx exactly once, and succeeds if the retry works", async () => {
    const fetchFn = stubFetch(res(503, "upstream boom"), res(200, geminiBody(JSON.stringify(GOOD_EVALUATION))));
    const result = await evaluate(OPTS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("gives up with UPSTREAM after the single 5xx retry also fails", async () => {
    const fetchFn = stubFetch(res(500, "boom"), res(500, "boom"));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "UPSTREAM" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("retries a network fault once, then reports NETWORK", async () => {
    const fetchFn = stubFetch(new TypeError("Failed to fetch"), new TypeError("Failed to fetch"));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "NETWORK" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("reports TIMEOUT on abort, and does not retry it", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const fetchFn = stubFetch(abort);
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "TIMEOUT" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("evaluate -- unusable responses", () => {
  it("reports INVALID_RESPONSE for a non-JSON envelope", async () => {
    stubFetch(res(200, "<html>gateway</html>"));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "INVALID_RESPONSE" });
  });

  it("reports INVALID_RESPONSE when the envelope has no text", async () => {
    stubFetch(res(200, JSON.stringify({ candidates: [] })));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "INVALID_RESPONSE" });
  });

  it("reports INVALID_RESPONSE for truncated model JSON", async () => {
    stubFetch(res(200, geminiBody('{"perFundamental": [{"conceptId": "c1", "sco')));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "INVALID_RESPONSE" });
  });

  it("reports INVALID_RESPONSE when the model returns a wrong-typed grade", async () => {
    const bad = { ...GOOD_EVALUATION, perQuestion: [{ questionId: "q1", correctness: "great" }] };
    stubFetch(res(200, geminiBody(JSON.stringify(bad))));
    expect(await evaluate(OPTS)).toEqual({ ok: false, error: "INVALID_RESPONSE" });
  });
});

describe("validateKey", () => {
  it("reports NO_KEY without a request", async () => {
    const fetchFn = stubFetch(res(200, "{}"));
    expect(await validateKey("", "gemini", "")).toEqual({ ok: false, error: "NO_KEY" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reports ok for a key the provider accepts", async () => {
    stubFetch(res(200, geminiBody("hi")));
    expect(await validateKey("k", "gemini", "")).toEqual({ ok: true, data: true });
  });

  it("reports BAD_KEY for a key the provider rejects", async () => {
    stubFetch(res(400, JSON.stringify({ error: { message: "API key not valid" } })));
    expect(await validateKey("k", "gemini", "")).toEqual({ ok: false, error: "BAD_KEY" });
  });
});

describe("providers", () => {
  it("falls back to the provider default when settings.model is blank", () => {
    expect(resolveModel("gemini", "")).toBe("gemini-2.5-flash");
    expect(resolveModel("grok", "  ")).toBe("grok-3");
  });

  it("uses an explicitly set model verbatim", () => {
    expect(resolveModel("gemini", "gemini-2.0-pro")).toBe("gemini-2.0-pro");
  });

  it("falls back to gemini for an unknown provider id rather than crashing", () => {
    expect(getProvider("nope").id).toBe("gemini");
  });

  it("grok sends the key as a bearer token, not a query param", () => {
    const req = getProvider("grok").buildRequest("secret", "grok-3", "prompt");
    expect(req.url).not.toContain("secret");
    expect((req.init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });
});
