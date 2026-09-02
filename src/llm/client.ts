import type { EvaluationResult } from "../types";
import { getProvider, resolveModel } from "./providers";
import { capPrompt } from "./prompt";
import { extractJson, parseEvaluation } from "./schema";

// Exactly the failure vocabulary the plan specifies (§9). Codes, never raw
// upstream text: an upstream message could echo the request back, and the
// request carries the user's key.
export type LlmErrorCode =
  | "NO_KEY"
  | "BAD_KEY"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK"
  | "UPSTREAM"
  | "INVALID_RESPONSE";

export type LlmResult<T> = { ok: true; data: T } | { ok: false; error: LlmErrorCode };

export const TIMEOUT_MS = 20_000;

export const ERROR_MESSAGE: Record<LlmErrorCode, string> = {
  NO_KEY: "No API key set.",
  BAD_KEY: "That API key was rejected. Check the key, and that its referrer restrictions allow this site.",
  RATE_LIMIT: "The provider is rate-limiting or your quota is exhausted. Try again later.",
  TIMEOUT: "The provider took too long to respond.",
  NETWORK: "Couldn't reach the provider. Check your connection.",
  UPSTREAM: "The provider returned an error.",
  INVALID_RESPONSE: "The provider's response couldn't be read as a valid evaluation.",
};

// A bad key is a 400 on Gemini (verified live: 400 / API_KEY_INVALID), not the
// 401 you might expect, so status alone can't classify it. 401/403 also mean
// "your key won't work here" -- including a referrer-restricted key, whose fix
// is the same thing the user has to go do.
function classifyHttp(status: number, body: string): LlmErrorCode {
  if (status === 429) return "RATE_LIMIT";
  if (status === 401 || status === 403) return "BAD_KEY";
  if (status === 400 && /API_KEY_INVALID|api key not valid|incorrect api key/i.test(body)) return "BAD_KEY";
  return "UPSTREAM";
}

function isRetryable(status: number): boolean {
  return status >= 500; // never retry a 4xx (plan §9)
}

async function fetchOnce(req: { url: string; init: RequestInit }): Promise<
  { kind: "ok"; body: string } | { kind: "http"; status: number; body: string } | { kind: "network" } | { kind: "timeout" }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(req.url, { ...req.init, signal: controller.signal });
    const body = await res.text();
    return res.ok ? { kind: "ok", body } : { kind: "http", status: res.status, body };
  } catch (err) {
    // An aborted fetch is our own timeout firing; anything else that throws
    // here is the network layer (DNS, offline, blocked).
    if (err instanceof Error && err.name === "AbortError") return { kind: "timeout" };
    return { kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}

// One retry, and only on 5xx or a network fault (plan §9). Deliberately not a
// backoff loop: this spends the user's own quota.
async function send(req: { url: string; init: RequestInit }): Promise<LlmResult<string>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await fetchOnce(req);
    if (result.kind === "ok") return { ok: true, data: result.body };
    if (result.kind === "timeout") return { ok: false, error: "TIMEOUT" };
    if (result.kind === "network") {
      if (attempt === 0) continue;
      return { ok: false, error: "NETWORK" };
    }
    if (isRetryable(result.status) && attempt === 0) continue;
    return { ok: false, error: classifyHttp(result.status, result.body) };
  }
  return { ok: false, error: "UPSTREAM" };
}

export interface EvaluateOptions {
  apiKey: string;
  provider: string;
  model: string;
  prompt: string;
}

export async function evaluate(opts: EvaluateOptions): Promise<LlmResult<EvaluationResult>> {
  if (!opts.apiKey.trim()) return { ok: false, error: "NO_KEY" };

  const adapter = getProvider(opts.provider);
  const model = resolveModel(opts.provider, opts.model);
  const sent = await send(adapter.buildRequest(opts.apiKey, model, capPrompt(opts.prompt)));
  if (!sent.ok) return sent;

  let envelope: unknown;
  try {
    envelope = JSON.parse(sent.data);
  } catch {
    return { ok: false, error: "INVALID_RESPONSE" };
  }

  const text = adapter.extractText(envelope);
  if (text === null) return { ok: false, error: "INVALID_RESPONSE" };

  const evaluation = parseEvaluation(extractJson(text));
  if (!evaluation) return { ok: false, error: "INVALID_RESPONSE" };
  return { ok: true, data: evaluation };
}

// Settings' "Validate" -- one cheap call so a bad key is reported on save
// rather than at the end of a revision (plan §9 key lifecycle, step 3).
export async function validateKey(apiKey: string, provider: string, model: string): Promise<LlmResult<true>> {
  if (!apiKey.trim()) return { ok: false, error: "NO_KEY" };
  const adapter = getProvider(provider);
  const sent = await send(adapter.buildProbeRequest(apiKey, resolveModel(provider, model)));
  return sent.ok ? { ok: true, data: true } : { ok: false, error: sent.error };
}
