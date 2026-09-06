import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../../context";
import { ERROR_MESSAGE, evaluate } from "../../llm/client";
import { buildEvaluationPrompt } from "../../llm/prompt";
import { buildPromptInput } from "../../revision/evaluate";
import { getConceptById } from "../../revision/session";
import { getTopicRevision, getV2Progress } from "../../store";
import { cx } from "../../cx";
import { Icon } from "../Icon";
import { Ring } from "../Ring";
import { SessionHeader } from "./SessionShell";
import type { RevisionAttempt, Topic } from "../../types";

const CONFIDENCE_STYLE: Record<string, { label: string; cls: string }> = {
  strong: { label: "Strong", cls: "bg-easy-soft text-easy" },
  partial: { label: "Partial", cls: "bg-medium-soft text-medium" },
  forgot: { label: "Forgot", cls: "bg-hard-soft text-hard" },
};

// A 0–5 sub-score rendered as five segments rather than "4/5" in grey text.
function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-micro text-muted w-20 shrink-0">{label}</span>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cx("h-1.5 w-3 rounded-full", n <= value ? "bg-accent" : "bg-border")}
          />
        ))}
      </span>
      <span className="text-micro text-faint tabular-nums">{value}/5</span>
    </div>
  );
}

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
  const passed = !!outcome?.passed;

  return (
    <div className="mx-auto w-full max-w-reading px-4 md:px-6 pt-6 pb-20">
      <SessionHeader topic={topic} onExit={onExit} exitLabel="Back to tracker" />

      {/* The verdict is now the biggest thing on the page instead of a bold
          word inside a paragraph. */}
      <div
        className={cx(
          "card p-4 mb-6",
          concluded && !outcome?.selfAssessed && (passed ? "border-easy/40" : "border-hard/40")
        )}
      >
        {running && (
          <div className="flex items-center gap-3">
            <Icon name="repeat" className="size-5 text-accent motion-safe:animate-spin [animation-duration:1.6s]" />
            <div>
              <div className="text-body font-bold">Evaluating…</div>
              <div className="text-caption text-muted">Grading your answers with {v2Store.settings.provider}.</div>
            </div>
          </div>
        )}

        {!running && concluded && (
          <div className="flex items-start gap-4 flex-wrap">
            {outcome?.selfAssessed ? (
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-sunken text-muted">
                <Icon name="check" className="size-6" />
              </span>
            ) : (
              <Ring pct={(outcome?.score ?? 0) / 100} size={56} stroke={5}>
                <span className="font-display text-head font-bold tabular-nums">{outcome?.score ?? 0}</span>
              </Ring>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cx(
                    "pill",
                    outcome?.selfAssessed
                      ? "bg-sunken text-muted"
                      : passed
                        ? "bg-easy-soft text-easy"
                        : "bg-hard-soft text-hard"
                  )}
                >
                  <Icon name={passed ? "check" : "alert"} className="size-3" />
                  {passed ? "Passed" : "Not passed"}
                </span>
                <span className="text-caption text-muted">
                  {outcome?.selfAssessed ? "marked done by you, not graded" : `scored ${outcome?.score ?? 0}/100`}
                </span>
              </div>
              <p className="text-ui text-muted m-0">
                {passed
                  ? `This topic is unlocked again${revision.nextDueAt ? `, next due ${revision.nextDueAt}` : ""}.`
                  : "The topic stays due, so you can run another session whenever you want."}
              </p>
              {graded && attempt.evaluation?.feedback && (
                <p className="card-inset mt-3 p-2.5 text-ui m-0">{attempt.evaluation.feedback}</p>
              )}
              {graded && (attempt.evaluation?.recommendedFocus.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="text-micro text-faint self-center">Focus next on:</span>
                  {attempt.evaluation?.recommendedFocus.map((f) => (
                    <span key={f} className="chip">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!running && !concluded && !hasKey && (
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <Icon name="check" className="size-4" />
            </span>
            <div>
              <div className="text-body font-bold">Session saved</div>
              <p className="text-ui text-muted m-0 mt-0.5">
                No API key set, so it hasn't been graded yet.{" "}
                <button type="button" onClick={onOpenSettings} className="btn-link">
                  Add a key in Settings
                </button>{" "}
                and come back — this submission will still be here.
              </p>
            </div>
          </div>
        )}

        {!running && !concluded && hasKey && (
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-hard-soft text-hard">
              <Icon name="alert" className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="text-body font-bold">Evaluation unavailable — your submission has been saved</div>
              {attempt.error && <p className="text-ui text-muted m-0 mt-0.5">{attempt.error}</p>}
              <button type="button" className="btn mt-2.5" onClick={() => void run()}>
                <Icon name="repeat" className="size-4" />
                Retry evaluation
              </button>
            </div>
          </div>
        )}

        {/* Placed after the status, not before it: this is the escape hatch
            for the situation the status just described. */}
        {!running && !concluded && (
          <div className="mt-4 pt-3.5 border-t border-border">
            <button type="button" className="btn" onClick={markDone}>
              <Icon name="check" className="size-4" />
              Mark this revision as done
            </button>
            <p className="text-micro text-muted mt-2 mb-0">
              Records it as completed and moves the topic on to its next interval. No score is stored, because
              nothing graded it.
            </p>
          </div>
        )}

        {attempt.questions.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-border flex flex-wrap items-center gap-1.5">
            <span className="text-micro text-faint mr-1">Self-rated:</span>
            {(["strong", "partial", "forgot"] as const).map((k) => (
              <span key={k} className={cx("pill", CONFIDENCE_STYLE[k].cls)}>
                {tally[k]} {CONFIDENCE_STYLE[k].label.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      <h2 className="font-display text-head font-bold mb-2.5 flex items-center gap-2">
        <Icon name="brain" className="size-4 text-accent" />
        Fundamentals
      </h2>
      {attempt.fundamentals.map((f) => {
        const concept = getConceptById(f.conceptId);
        const grade = fundamentalGrade.get(f.conceptId);
        return (
          <div key={f.conceptId} className="card p-4 mb-3">
            <div className="flex items-start gap-2 mb-2.5">
              <div className="font-semibold text-body min-w-0 flex-1">{concept?.prompt ?? f.conceptId}</div>
              {grade && (
                <span
                  className={cx(
                    "pill shrink-0 tabular-nums",
                    grade.score >= 4 ? "bg-easy-soft text-easy" : grade.score >= 3 ? "bg-medium-soft text-medium" : "bg-hard-soft text-hard"
                  )}
                >
                  {grade.score}/5
                </span>
              )}
            </div>
            <div className="mb-2.5">
              <div className="field-label">Your answer</div>
              <div className="text-ui">{f.answer || <span className="text-faint italic">(left blank)</span>}</div>
            </div>
            {grade?.note && <p className="card-inset p-2.5 text-ui m-0 mb-2.5">{grade.note}</p>}
            {grade && grade.missing.length > 0 && (
              <div className="mb-2.5">
                <div className="field-label text-hard">Missed</div>
                <div className="text-caption text-muted">{grade.missing.join("; ")}</div>
              </div>
            )}
            {concept && (
              <div>
                <div className="field-label">Should cover</div>
                <div className="text-caption text-muted">{concept.expectedConcepts.join("; ")}</div>
              </div>
            )}
          </div>
        );
      })}

      {attempt.questions.length > 0 && (
        <h2 className="font-display text-head font-bold mb-2.5 mt-7 flex items-center gap-2">
          <Icon name="target" className="size-4 text-accent" />
          Questions
        </h2>
      )}
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        const progress = getV2Progress(v2Store, q.questionId);
        const grade = questionGrade.get(q.questionId);
        return (
          <div key={q.questionId} className="card p-4 mb-3">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="font-semibold text-body">{problem?.question ?? q.questionId}</span>
              {q.confidence && (
                <span className={cx("pill", CONFIDENCE_STYLE[q.confidence].cls)}>
                  {CONFIDENCE_STYLE[q.confidence].label}
                </span>
              )}
            </div>

            {grade && (
              <div className="card-inset p-3 mb-3 grid gap-1.5 sm:grid-cols-2">
                <ScoreBar label="Correctness" value={grade.correctness} />
                <ScoreBar label="Approach" value={grade.approach} />
                <ScoreBar label="Pseudocode" value={grade.pseudocode} />
                <ScoreBar label="Complexity" value={grade.complexity} />
              </div>
            )}
            {grade?.note && <p className="text-ui m-0 mb-2.5">{grade.note}</p>}
            {grade && grade.mistakes.length > 0 && (
              <div className="mb-3 rounded-lg border-l-2 border-l-hard bg-hard-soft/40 px-2.5 py-2">
                <div className="field-label text-hard mb-0.5">Flagged</div>
                <div className="text-caption text-muted">{grade.mistakes.join("; ")}</div>
              </div>
            )}

            {/* Side by side so recall and the stored solution can actually be
                compared, which is the whole point of this screen. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-ui">
              <div className="rounded-lg border border-accent-line bg-accent-soft/40 p-3">
                <div className="field-label text-accent">Your recall</div>
                <Field label="Approach" value={q.approach} />
                <Field label="Pseudocode" value={q.pseudocode} />
                <Field label="Complexity" value={q.complexity} />
                {q.edgeCases && <Field label="Edge cases" value={q.edgeCases} />}
              </div>
              <div className="card-inset p-3">
                <div className="field-label">Your stored solution</div>
                <Field label="Approach" value={progress.approach} />
                <Field label="Pseudocode" value={progress.pseudocode} />
                {progress.code && (
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-caption rounded-md bg-bg border border-border p-2 overflow-x-auto">
                    {progress.code}
                  </pre>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <span className="text-micro text-faint block">{label}</span>
      <span className="text-ui">{value || "—"}</span>
    </div>
  );
}
