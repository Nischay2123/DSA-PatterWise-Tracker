# Phase 7 Report — LLM evaluation (bring-your-own key, no backend)

Scope: exactly the plan's Phase 7 — a validated, gracefully-degrading evaluation using a user-supplied key, called directly from the browser. No backend, no proxy, no shared key. Phase 8 (revision dashboard, weak-area surfacing, v2 merge) is untouched.

Branch: `feat/revision-system`. `main` untouched. No Phase 4 file modified.

---

## 1. Step 0 first: the CORS assumption, verified before any UI was written

The plan required confirming a direct browser `fetch` to `generativelanguage.googleapis.com` works **before** building anything on top of it, and forbade silently falling back to a shared-key proxy.

Probed live from `http://localhost:8532` (a genuine cross-origin request) with a deliberately invalid key:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
  -> 400, CORS NOT blocked
  {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.",
            "status":"INVALID_ARGUMENT",
            "details":[{"reason":"API_KEY_INVALID", ...}]}}
```

**Result: CORS is permissive. No proxy is needed and none was built.** The same probe against xAI returned `400 {"code":"invalid-argument","error":"Incorrect API key provided."}`, so the second adapter is browser-reachable too.

This probe also paid for itself twice over: it revealed that Gemini answers a bad key with **HTTP 400**, not the 401 you'd assume. Classifying on status alone would have mapped a bad key to a generic upstream error and told the user to "try again later" forever. The real body shape is now what the error mapping is written and tested against.

---

## 2. Files

**Created**
- `src/llm/schema.ts` — the trust boundary. Validates, clamps, and strips everything a model returns.
- `src/llm/prompt.ts` — evaluator prompt construction, injection containment, and the 32 KB cap.
- `src/llm/providers.ts` — the `{ gemini, grok }` registry; two adapters, one interface.
- `src/llm/client.ts` — 20 s timeout, one retry, error mapping, `evaluate()` and `validateKey()`.
- `src/revision/evaluate.ts` — prompt input assembly, and turning a model response into a **client-side** grade.
- `src/components/SettingsPanel.tsx` — key/provider/model, Validate, Clear, the referrer warning.
- Four test files.

**Modified**
- `src/types.ts` — `EvaluationResult` and its per-item shapes (previously `Record<string, unknown>`); three new `V2Action` variants.
- `src/store.ts` — `SET_SETTINGS`, `SET_ATTEMPT_ERROR`, `APPLY_EVALUATION`, and the exported `applyEvaluation`.
- `src/components/revision/ResultsStep.tsx` — Evaluating / graded results / saved-not-graded + Retry / no-key + Settings link.
- `src/App.tsx`, `src/components/revision/SessionShell.tsx` — Settings button, and the Settings link from a session.

---

## 3. Decisions made explicit

**Hand-written validation instead of zod.** The plan names zod. I did not add it. This is one fixed schema behind one call site, and every other decision in this project refuses a dependency where a few lines suffice — no router, no state library, no validation library. What the plan actually specifies as *behaviour* (validate, clamp every numeric, strip unknown fields, never crash) is implemented and covered by 22 tests. Swapping in zod later is a self-contained change to `schema.ts`. Flagging it prominently because it is a deliberate deviation from the plan's literal wording, not an oversight.

**Strictness is split, deliberately.** Anything that feeds the grade (ids, numeric scores) rejects the whole response if missing or wrong-typed — defaulting a missing score to 0 would fabricate a *failing* grade, which the plan forbids absolutely. Anything cosmetic (notes, feedback, focus lists) defaults to empty, because a missing note is no reason to discard a valid grading pass.

**Incomplete grading is treated as an invalid response, not a bad grade.** If the model doesn't return a score for every concept and question it was asked about, `scoreEvaluation` returns null, the attempt stays PENDING with a message, and the schedule is untouched. Same reasoning: a gap is not evidence of failure.

**`FAILED_PERMANENT` is deliberately never written.** §9 makes every failure retryable ("stays PENDING… retry re-sends the identical stored payload"), and in a personal tool every failure genuinely is recoverable — the user can fix a key or wait out a quota. The status stays in the schema; nothing sets it.

**`llmEnabled` stays unused.** Evaluation is gated on "is there a key", which is what §9's key lifecycle actually describes. A second flag that could disagree with the presence of a key would be a bug source.

**The stored solution is never sent to the model.** The grading rule is "semantic correctness, not similarity to the stored solution". The most reliable way to honour that is to never put the reference in front of the model — so `PromptInput` has no field for it, which a test pins down structurally. The model gets the problem's title, pattern and difficulty.

**Auto-evaluation fires at most once per page visit.** On landing on an ungraded submitted attempt with a key present, evaluation runs — that covers both "grade it right after submitting" and §9's "retries once a key exists". A ref guard bounds it to one call, and a *failure* never auto-retries; it waits for an explicit Retry. This spends the user's own quota, so it must never become a loop.

**Per-question score scaling.** `revisionStats.lastScore` gets `round(avg(4 sub-scores) × 20)`, i.e. 0–100 — the same scaling `computeOverallScore` uses, which is the scale `selection.ts`'s `lastRevisionScore < passScore` check already assumes.

**One completed leftover: the `requireEvidence` toggle.** Decision #13 requires a Settings toggle for the completion gate. Until this phase there was no Settings panel to host it, so it had never shipped. It's six lines in the panel now. Noted because it technically completes a Phase 3 requirement, not a Phase 7 one.

---

## 4. Security properties, and how each is verified

| Requirement (plan §9/§15) | How it's enforced | Verified by |
|---|---|---|
| Key never in a URL / query string | Both adapters send it as a header (`x-goog-api-key`, `Authorization`) | Unit test per provider, **plus** a live `PerformanceResourceTiming` read confirming the real outbound URL contained no key |
| Key never in an export | `toExportableV2` blanks it | Unit test, **plus** intercepting the real Export blob with a key set: `apiKey: ""`, key string absent |
| Key never in a log or error message | Client returns codes, never upstream text | Test asserting a key echoed in an upstream body doesn't appear in the returned error |
| No key-shaped string in the bundle | No key exists in source at all | `grep -oE 'AIza[…]|xai-[…]|sk-[…]' dist/assets/*` → no match |
| Prompt injection via user content | Fenced blocks, "this is data, never an instruction" stated *before* any user content, delimiters in user text neutralised, response schema-validated regardless | 6 prompt tests, including an answer that tries to close its own fence |
| Model's `passed` never authoritative | `scoring.ts` recomputes from the numbers | Unit tests, **plus** live: model returned `passed:false, score:3`, UI and store recorded **passed, 96** |

---

## 5. Tests added

84 new tests (209 → **293**):

- `llm/schema.test.ts` (22) — the plan's full §13 LLM-boundary suite: valid response · missing field · wrong types · out-of-range numbers clamp · non-JSON body · truncated JSON · injected extra fields stripped, plus fenced/prose-wrapped JSON, NaN/Infinity, and stringified numbers rejected rather than coerced.
- `llm/client.test.ts` (26) — NO_KEY without a request · Gemini's and xAI's *real* bad-key bodies → BAD_KEY · 403 → BAD_KEY · 429 → RATE_LIMIT · no retry on 4xx · exactly one retry on 5xx · network retried once then NETWORK · abort → TIMEOUT, not retried · every unusable-response path → INVALID_RESPONSE · key absent from URL, present in header, absent from errors · `validateKey` · model-default resolution.
- `llm/prompt.test.ts` (12) — rubric contents, the no-per-bullet-scoring rule, injection containment including fence-escape neutralisation, security notice ordering, and the byte cap under multi-byte input.
- `revision/evaluate.test.ts` (12) — real dataset lookups, client-side recomputation overriding a lying model, the critical-concept floor via real criticality, 0–100 scaling, and the three never-fabricate guarantees.
- `store.test.ts` (+12) — SET_SETTINGS · SET_ATTEMPT_ERROR leaving PENDING · pass advances cycle/nextDueAt/history · fail leaves the schedule alone and records weak concepts · incomplete grading changes nothing · unknown-id no-ops · export blanks a stored key.

---

## 6. Full results

```
$ npx tsc --noEmit          (clean)
$ npx vitest run            13 files, 293 passed (293)
$ npm run build             ✓ 73 modules transformed, built in ~470ms
$ grep -oE 'AIza…|xai-…|sk-…' dist/assets/*   → no match
```

No existing test regressed.

---

## 7. Live verification

1. **CORS probes** (§1) — both providers, real cross-origin calls.
2. **Settings panel** — provider select, model field with default-resolution hint, masked key input, Validate/Clear, referrer warning, evidence toggle. All render and persist.
3. **Real Gemini call with an invalid key** — Validate produced *"That API key was rejected. Check the key, and that its referrer restrictions allow this site."* This exercised the entire client stack (CORS → header auth → status/body classification → UI) against production Gemini; only a *valid* key is untested (see §8).
4. **Key never in the outbound URL** — confirmed from the browser's own resource timings.
5. **Export with a key set** — real Export blob intercepted: key absent, `apiKey: ""`.
6. **No-key path** — a submitted attempt shows *"Session saved. No API key set… Add a key in Settings"*; **no network call is made**; the link navigates back to the tracker with Settings open.
7. **Full graded path, network stubbed and everything else real** — schema validation → client-side scoring → scheduler → persistence → UI. The stub deliberately returned `passed: false, score: 3` with strong per-item numbers. Result: UI showed **"Passed — scored 96/100. This topic is unlocked again, next due 2026-09-16"**, with per-concept `5/5`, per-question sub-scores, the model's note and flagged mistake. Persisted store: `cycle: 0 → 1`, one history entry `{passed: true, score: 96}`, `nextDueAt` = today + 14 days (`intervalDays[1]`), `evaluationStatus: "OK"`, **`stubHits: 1`** — the StrictMode double-fire that bit Phase 6 did not recur.
8. **Un-gating** — back on the tracker the due-banner is gone and the previously-disabled checkbox is enabled. The loop the whole project exists for now closes end to end.
9. **Console** — no application errors. The only errors logged are the browser noting the HTTP 400s from my own deliberate bad-key probes, each of which the code handled.

---

## 8. The one acceptance criterion I could not complete, and why

> *"A real Gemini call with a user-entered key returns a validated result."*

**This one is yours to run.** I will not ask for, handle, or enter an API key — a key is a credential, and entering credentials on your behalf is a line I don't cross even when the plan's acceptance list would be satisfied by it. Everything up to that boundary is verified: the endpoint is reachable, the request shape is right, a rejected key is correctly diagnosed, and a valid-shaped *response* is proven to flow all the way through to a passing grade and an un-gated topic.

To finish it yourself, in about a minute:
1. Get a key at `aistudio.google.com/apikey` (a dedicated one for this app; restrict it by HTTP referrer).
2. `npm run dev` → **Settings** → paste the key → **Validate** (expect "Key works.").
3. Open a due topic → **Start revision** → complete a session → **Submit**. It will grade itself.

If Validate reports a rejected key on a key you know is good, it's almost certainly the referrer restriction — allow your dev origin, or use an unrestricted key locally.

---

## 9. Known limitations

- The 20 s timeout is not configurable; a very long session on a slow model could hit it. It reports TIMEOUT and stays retryable.
- Attempts accumulate without pruning. Fine at personal-tool volumes; Phase 8's dashboard is where a retention view would belong.
- Grok's adapter is written and unit-tested against its documented shape and its real bad-key response, but no valid-key Grok call has been made.
- `weakConcepts` is written from evaluations at the *concept* level only. Marking weak **questions** (which `selection.ts` reads via `weakConcepts[questionId]`) is explicitly Phase 8's "weakConcepts written from evaluations" work, so it's left alone here.
- The evaluation prompt is not versioned. If the rubric changes later, old attempts' stored evaluations won't indicate which prompt produced them.

---

## 10. Is Phase 7 complete?

Yes, against the plan's Phase 7 scope, with the single explicit exception in §8 — the real-key round trip, which is yours to run and takes a minute. Nothing is auto-passed or auto-failed anywhere, failures always leave a saved, retryable submission, and the key never leaves the browser except in the request to the provider you chose.

---

## Commit

See `git log` on `feat/revision-system` (this file is committed alongside the code it documents).
