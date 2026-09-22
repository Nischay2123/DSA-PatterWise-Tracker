// Two adapters behind one interface, no framework (plan §9&10). Both are
// reachable cross-origin from a page origin with the key in a header; a bad
// key comes back 400 on Gemini and 401 on Groq (see classifyHttp).
//
// The key travels in a header for both. Never a query string: a key in a URL
// lands in history, referrers and logs, which the plan forbids outright.

export type ProviderId = "gemini" | "groq";

export interface ProviderRequest {
  url: string;
  init: RequestInit;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  defaultModel: string;
  // The grading call.
  buildRequest(apiKey: string, model: string, prompt: string): ProviderRequest;
  // The cheapest possible call that proves a key works, for Settings' Validate.
  buildProbeRequest(apiKey: string, model: string): ProviderRequest;
  // Pulls the model's raw text out of the provider's envelope.
  extractText(body: unknown): string | null;
}

function get(obj: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

// Gemini's structured-output schema. Asking for JSON at the API level rather
// than only in the prompt is what keeps the happy path from ever needing the
// fence-stripping fallback in schema.ts.
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    score: { type: "number" },
    perFundamental: {
      type: "array",
      items: {
        type: "object",
        properties: {
          conceptId: { type: "string" },
          score: { type: "number" },
          missing: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
        required: ["conceptId", "score"],
      },
    },
    perQuestion: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionId: { type: "string" },
          correctness: { type: "number" },
          approach: { type: "number" },
          pseudocode: { type: "number" },
          complexity: { type: "number" },
          mistakes: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
        required: ["questionId", "correctness", "approach", "pseudocode", "complexity"],
      },
    },
    weakConcepts: { type: "array", items: { type: "string" } },
    feedback: { type: "string" },
    recommendedFocus: { type: "array", items: { type: "string" } },
  },
  required: ["passed", "score", "perFundamental", "perQuestion"],
} as const;

const gemini: ProviderAdapter = {
  id: "gemini",
  label: "Google Gemini",
  defaultModel: "gemini-3.6-flash",
  buildRequest(apiKey, model, prompt) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0, // grading should be as reproducible as the model allows
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
      },
    };
  },
  buildProbeRequest(apiKey, model) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      },
    };
  },
  extractText(body) {
    const text = get(body, "candidates", 0, "content", "parts", 0, "text");
    return typeof text === "string" ? text : null;
  },
};

// OpenAI-compatible, so the envelope handling below is the stock one.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const groq: ProviderAdapter = {
  id: "groq",
  label: "Groq",
  defaultModel: "llama-3.3-70b-versatile",
  buildRequest(apiKey, model, prompt) {
    return {
      url: GROQ_URL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      },
    };
  },
  buildProbeRequest(apiKey, model) {
    return {
      url: GROQ_URL,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      },
    };
  },
  extractText(body) {
    const text = get(body, "choices", 0, "message", "content");
    return typeof text === "string" ? text : null;
  },
};

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = { gemini, groq };

export function getProvider(id: string): ProviderAdapter {
  if (id === "grok") return groq; // stores written before xAI was swapped out for Groq
  return PROVIDERS[id as ProviderId] ?? gemini;
}

// settings.model is free text so a quota or model change is a text-field edit
// (plan §9). Empty means "whatever this provider's default is" -- which also
// means existing stores, whose model is "", need no migration.
export function resolveModel(id: string, model: string): string {
  return model.trim() || getProvider(id).defaultModel;
}
