import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../../context";
import { ERROR_MESSAGE, evaluate } from "../../llm/client";
import { buildEvaluationPrompt } from "../../llm/prompt";
import { buildPromptInput } from "../../revision/evaluate";
import { getConceptById } from "../../revision/session";
import { getTopicRevision, getV2Progress } from "../../store";
import type { RevisionAttempt, Topic } from "../../types";

const CONFIDENCE_LABEL: Record<string, string> = { strong: "Strong", partial: "Partial", forgot: "Forgot" };

export function ResultsStep({
  topic,
  attempt,
  onExit,
  onOpenSettings,
}: {
  topic: Topic;
  attempt: RevisionAttempt;
  onExit: () => void;
  onOpenSettings: () => void;
}) {
  const { v2Store, dispatchV2 } = useStore();
  const [running, setRunning] = useState(false);
  const firedForRef = useRef<string | null>(null);

  const problemById = new Map(topic.patterns.flatMap((p) => p.problems).map((p) => [p.id, p]));
  const tally = { strong: 0, partial: 0, forgot: 0 } as Record<string, number>;
  for (const q of attempt.questions) if (q.confidence) tally[q.confidence]++;

  const hasKey = !!v2Store.settings.apiKey.trim();
  // Two different things: `concluded` means this attempt is finished with
  // (graded OR marked done by hand); `graded` means an evaluation actually
  // produced per-item scores. A self-assessed revision is concluded but not
  // graded, so it must not keep offering the mark-done button or auto-fire
  // the evaluator, yet has no scores to render either.
  const concluded = attempt.evaluationStatus === "OK";
  const graded = concluded && attempt.evaluation;
  const fundamentalGrade = new Map((attempt.evaluation?.perFundamental ?? []).map((f) => [f.conceptId, f]));
  const questionGrade = new Map((attempt.evaluation?.perQuestion ?? []).map((q) => [q.questionId, q]));

  const run = useCallback(async () => {
    setRunning(true);
    dispatchV2({ type: "SET_ATTEMPT_ERROR", attemptId: attempt.id, error: null });
    const prompt = buildEvaluationPrompt(buildPromptInput(attempt, topic));
    const result = await evaluate({
      apiKey: v2Store.settings.apiKey,
      provider: v2Store.settings.provider,
      model: v2Store.settings.model,
      prompt,
    });
    if (result.ok) {
      dispatchV2({ type: "APPLY_EVALUATION", attemptId: attempt.id, evaluation: result.data });
    } else {
      // The submission is already saved; a failure only ever adds a message.
      dispatchV2({ type: "SET_ATTEMPT_ERROR", attemptId: attempt.id, error: ERROR_MESSAGE[result.error] });
    }
    setRunning(false);
  }, [attempt, topic, v2Store.settings, dispatchV2]);

  // Fires once per mount for an un-evaluated attempt that has a key to use --
  // that covers both "evaluate right after submitting" and §9's "retries once
  // a key exists". Bounded by the ref so it can never become a retry loop
  // spending the user's quota; a failure waits for an explicit Retry.
  useEffect(() => {
    if (concluded || !hasKey || running) return;
    if (firedForRef.current === attempt.id) return;
    firedForRef.current = attempt.id;
    void run();
  }, [concluded, hasKey, running, attempt.id, run]);

  // The escape hatch. Without it, a user with no key (or a provider that's
  // down) can never clear a due topic, and gating would strand them.
  const markDone = () => dispatchV2({ type: "MARK_REVISION_SELF_ASSESSED", attemptId: attempt.id });

  const revision = getTopicRevision(v2Store, topic.id);
  // The outcome shown is the one scoring.ts computed and the scheduler
  // recorded -- never the model's own `passed`, which is advisory (plan §9).
  const outcome = revision.history[revision.history.length - 1];

  return (
    <div className="mx-auto w-full max-w-reading px-4 md:px-6 pt-6 pb-16">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-title font-semibold tracking-tight m-0">Revision — {topic.name}</h1>
        <button type="button" onClick={onExit} className="btn-link text-ui">
          Back to tracker
        </button>
      </div>

      <div className="card p-4 mb-5 text-ui">
        {running && <div><strong>Evaluating…</strong> Grading your answers with {v2Store.settings.provider}.</div>}

        {!running && concluded && (
          <div>
            <strong>{outcome?.passed ? "Passed" : "Not passed"}</strong>
            {outcome?.selfAssessed
              ? " — marked done by you, not graded."
              : ` — scored ${outcome?.score ?? 0}/100.`}
            {outcome?.passed ? (
              <span> This topic is unlocked again{revision.nextDueAt ? `, next due ${revision.nextDueAt}` : ""}.</span>
            ) : (
              <span> The topic stays due, so you can run another session whenever you want.</span>
            )}
            {graded && attempt.evaluation?.feedback && (
              <div className="text-muted mt-1.5">{attempt.evaluation.feedback}</div>
            )}
            {graded && (attempt.evaluation?.recommendedFocus.length ?? 0) > 0 && (
              <div className="text-muted mt-1.5">Focus next on: {attempt.evaluation?.recommendedFocus.join(", ")}</div>
            )}
          </div>
        )}

        {!running && !concluded && !hasKey && (
          <div>
            <strong>Session saved.</strong> No API key set, so it hasn't been graded yet.{" "}
            <button type="button" onClick={onOpenSettings} className="btn-link">
              Add a key in Settings
            </button>{" "}
            and come back — this submission will still be here.
          </div>
        )}

        {!running && !concluded && hasKey && (
          <div>
            <strong>Evaluation unavailable. Your submission has been saved.</strong>
            {attempt.error && <div className="text-muted mt-1">{attempt.error}</div>}
            <div className="mt-2">
              <button type="button" className="btn" onClick={() => void run()}>
                Retry evaluation
              </button>
            </div>
          </div>
        )}

        {/* Placed after the status, not before it: this is the escape hatch
            for the situation the status just described. */}
        {!running && !concluded && (
          <div className="mt-3 pt-3 border-t border-border">
            <button type="button" className="btn" onClick={markDone}>
              Mark this revision as done
            </button>
            <p className="text-muted mt-1.5 mb-0 text-caption">
              Records it as completed and moves the topic on to its next interval. No score is stored, because
              nothing graded it.
            </p>
          </div>
        )}

        {attempt.questions.length > 0 && (
          <div className="text-muted mt-3 pt-3 border-t border-border text-caption">
            Self-rated confidence: {tally.strong} strong · {tally.partial} partial · {tally.forgot} forgot
          </div>
        )}
      </div>

      <h2 className="text-head font-semibold mb-2.5">Fundamentals</h2>
      {attempt.fundamentals.map((f) => {
        const concept = getConceptById(f.conceptId);
        const grade = fundamentalGrade.get(f.conceptId);
        return (
          <div key={f.conceptId} className="card p-3.5 mb-3">
            <div className="font-semibold text-body mb-1.5">
              {concept?.prompt ?? f.conceptId}
              {grade && <span className="ml-2 text-micro text-muted font-normal">{grade.score}/5</span>}
            </div>
            <div className="text-ui mb-2">
              <span className="text-muted">Your answer: </span>
              {f.answer || <span className="text-muted italic">(left blank)</span>}
            </div>
            {grade?.note && <div className="text-ui mb-1.5">{grade.note}</div>}
            {grade && grade.missing.length > 0 && (
              <div className="text-caption text-muted mb-1.5">Missed: {grade.missing.join("; ")}</div>
            )}
            {concept && <div className="text-caption text-muted">Should cover: {concept.expectedConcepts.join("; ")}</div>}
          </div>
        );
      })}

      {attempt.questions.length > 0 && <h2 className="text-head font-semibold mb-2.5 mt-6">Questions</h2>}
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        const progress = getV2Progress(v2Store, q.questionId);
        const grade = questionGrade.get(q.questionId);
        return (
          <div key={q.questionId} className="card p-3.5 mb-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-semibold">{problem?.question ?? q.questionId}</span>
              {q.confidence && <span className="text-micro text-muted">{CONFIDENCE_LABEL[q.confidence]}</span>}
              {grade && (
                <span className="text-micro text-muted">
                  correctness {grade.correctness}/5 · approach {grade.approach}/5 · pseudocode {grade.pseudocode}/5 ·
                  complexity {grade.complexity}/5
                </span>
              )}
            </div>
            {grade?.note && <div className="text-ui mb-2">{grade.note}</div>}
            {grade && grade.mistakes.length > 0 && (
              <div className="text-caption text-muted mb-2">Flagged: {grade.mistakes.join("; ")}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-ui">
              <div>
                <div className="field-label">Your recall</div>
                <div className="mb-1.5"><span className="text-muted">Approach: </span>{q.approach || "—"}</div>
                <div className="mb-1.5"><span className="text-muted">Pseudocode: </span>{q.pseudocode || "—"}</div>
                <div className="mb-1.5"><span className="text-muted">Complexity: </span>{q.complexity || "—"}</div>
                {q.edgeCases && <div><span className="text-muted">Edge cases: </span>{q.edgeCases}</div>}
              </div>
              <div>
                <div className="field-label">Your stored solution</div>
                <div className="mb-1.5"><span className="text-muted">Approach: </span>{progress.approach || "—"}</div>
                <div className="mb-1.5"><span className="text-muted">Pseudocode: </span>{progress.pseudocode || "—"}</div>
                {progress.code && (
                  <pre className="whitespace-pre-wrap font-mono text-caption card-soft p-2 overflow-x-auto">{progress.code}</pre>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
