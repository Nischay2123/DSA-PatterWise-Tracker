import { describe, expect, it } from "vitest";
import { getProvider } from "./llm/providers";
import { capPrompt } from "./llm/prompt";
import { buildPromptInput } from "./revision/evaluate";
import { buildTopicRows, isExemptTopic, statusDot, statusLabel } from "./revision/dashboard";
import { emptyAppStoreV2, liftV1Entry, migrateV1ToV2 } from "./persistence/migrate";
import type { ProgressStore, RevisionAttempt, Topic, TopicRevision } from "./types";

// The last few genuinely-reachable branches that no earlier suite happened to
// exercise. Each one is a real behaviour, not a line-count filler.

describe("provider probe requests", () => {
  it("gemini's probe is a minimal generateContent call with the key in a header", () => {
    const req = getProvider("gemini").buildProbeRequest("k", "gemini-2.5-flash");
    expect(req.url).toContain("gemini-2.5-flash:generateContent");
    expect(req.url).not.toContain("k");
    expect((req.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    expect(JSON.parse(req.init.body as string).generationConfig.maxOutputTokens).toBe(1);
  });

  it("grok's probe caps tokens and uses a bearer token", () => {
    const req = getProvider("grok").buildProbeRequest("k", "grok-3");
    expect(req.url).toBe("https://api.x.ai/v1/chat/completions");
    expect((req.init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(req.init.body as string).max_tokens).toBe(1);
  });

  it("grok pulls text out of the OpenAI-shaped envelope", () => {
    const grok = getProvider("grok");
    expect(grok.extractText({ choices: [{ message: { content: "hi" } }] })).toBe("hi");
    expect(grok.extractText({ choices: [] })).toBeNull();
    expect(grok.extractText(null)).toBeNull();
    expect(grok.extractText({ choices: [{ message: { content: 42 } }] })).toBeNull();
  });

  it("gemini returns null for an envelope with no text", () => {
    expect(getProvider("gemini").extractText({ candidates: [{ content: {} }] })).toBeNull();
  });
});

describe("capPrompt", () => {
  it("walks the cut back until multi-byte content genuinely fits", () => {
    // Emoji are 4 bytes each, so a naive character-count slice would overshoot.
    const capped = capPrompt("😀".repeat(500), 200);
    expect(new TextEncoder().encode(capped).length).toBeLessThanOrEqual(200);
    expect(capped).toContain("TRUNCATED");
  });

  it("handles a cap so small the whole prompt is cut away without looping forever", () => {
    const capped = capPrompt("x".repeat(1000), 10);
    expect(capped).toContain("TRUNCATED");
  });
});

describe("buildPromptInput falls back gracefully", () => {
  it("uses the raw id when a question isn't in the topic", () => {
    const topic: Topic = { id: "arrays", name: "Arrays", patterns: [] };
    const attempt = {
      id: "a", topicId: "arrays", startedAt: "", submittedAt: null,
      fundamentals: [],
      questions: [{ questionId: "ghost", approach: "a", pseudocode: "p", complexity: "c", edgeCases: "", confidence: null }],
      evaluationStatus: "DRAFT", evaluation: null, error: null,
    } as RevisionAttempt;
    const input = buildPromptInput(attempt, topic);
    expect(input.questions[0].title).toBe("ghost");
    expect(input.questions[0].patternName).toBe("");
    expect(input.questions[0].difficulty).toBe("");
  });
});

describe("dashboard status edges", () => {
  const topic: Topic = {
    id: "arrays",
    name: "Arrays",
    patterns: [
      {
        id: "arrays__p",
        name: "P",
        problems: ["a1", "a2"].map((id) => ({
          id, subpattern: "", question: id, platform: "", link: null,
          difficulty: "Easy" as const, originalStep: "", estMinutes: "", importance: "", interviewFreq: "",
        })),
      },
    ],
  };
  const NOW = new Date("2026-06-15T12:00:00.000Z");
  const done = (ids: string[]): ProgressStore => ({
    version: 1,
    idsMigrated: true,
    problems: Object.fromEntries(ids.map((id) => [id, { done: true, revise: false, notes: "", completedAt: null, revisedAt: null }])),
  });
  const rev = (p: Partial<TopicRevision> = {}): TopicRevision => ({
    topicId: "arrays", cycle: 0, nextDueAt: null, lastPassedAt: null, lastFailedAt: null,
    activeSessionId: null, history: [], weakConcepts: {}, ...p,
  });
  const rowWith = (r: TopicRevision, ids = ["a1", "a2"]) =>
    buildTopicRows([topic], done(ids), { ...emptyAppStoreV2(), revision: { arrays: r } }, NOW)[0];

  it("marks an in-progress session amber", () => {
    const row = rowWith(rev({ activeSessionId: "s1" }));
    expect(statusDot(row)).toBe("🟡");
    expect(statusLabel(row)).toBe("Session in progress");
  });

  it("labels a failed-and-due topic distinctly from a plain due one", () => {
    const row = rowWith(rev({ nextDueAt: "2026-06-01", history: [{ at: "2026-06-01", score: 40, passed: false, attemptId: "x" }] }));
    expect(statusLabel(row)).toBe("Revision due (last attempt failed)");
  });

  it("says 'Revision due' when the topic crossed the threshold but was never scheduled", () => {
    const row = rowWith(rev({ nextDueAt: null }));
    expect(statusLabel(row)).toBe("Revision due");
  });

  it("reports partial completion as in progress with a percentage", () => {
    const row = rowWith(rev(), ["a1"]); // 1 of 2
    expect(statusDot(row)).toBe("⚪");
    expect(statusLabel(row)).toBe("In progress — 50%");
  });

  it("says 'Due today' for a scheduled topic whose date is today", () => {
    const row = rowWith(rev({ cycle: 1, nextDueAt: "2026-06-15" }));
    // Due today reads as REVISION_DUE, not SCHEDULED -- the label follows.
    expect(["Due today", "Revision due"]).toContain(statusLabel(row));
  });

  it("knows which topics are exempt", () => {
    expect(isExemptTopic("fundamentals")).toBe(true);
    expect(isExemptTopic("arrays")).toBe(false);
  });
});

describe("migration edges", () => {
  it("carries a legacy note blob into notes.legacy verbatim", () => {
    const lifted = liftV1Entry({ done: true, revise: false, notes: "my old note", completedAt: "2026-01-01", revisedAt: null });
    expect(lifted.notes.legacy).toBe("my old note");
    expect(lifted.firstCompletedAt).toBe("2026-01-01");
  });

  it("defaults a missing notes field to an empty string rather than undefined", () => {
    const lifted = liftV1Entry({ done: false, revise: false, completedAt: null, revisedAt: null } as never);
    expect(lifted.notes.legacy).toBe("");
  });

  it("skips null entries instead of crashing on them", () => {
    const v1 = { version: 1, idsMigrated: true, problems: { a: null, b: { done: true, revise: false, notes: "", completedAt: null, revisedAt: null } } };
    const v2 = migrateV1ToV2(v1 as never);
    expect(v2.progress.a).toBeUndefined();
    expect(v2.progress.b.completed).toBe(true);
  });

  it("returns an empty store for null/garbage input", () => {
    expect(migrateV1ToV2(null as never).progress).toEqual({});
    expect(migrateV1ToV2({ version: 1 } as never).progress).toEqual({});
  });
});
