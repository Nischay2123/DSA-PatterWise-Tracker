import { useStore } from "../../context";
import { cx } from "../../cx";
import type { RevisionAttempt, Topic } from "../../types";

const OPTIONS = [
  { value: "strong" as const, label: "Strong — nailed it" },
  { value: "partial" as const, label: "Partial — got most of it" },
  { value: "forgot" as const, label: "Forgot — mostly blanked" },
];

// Confidence is learning data, never a score (plan §8) -- it only moves
// future selection weights (revision/selection.ts already reads
// lastConfidence). Nothing here computes a pass/fail from it.
export function ConfidenceStep({
  attempt,
  topic,
  onBack,
}: {
  attempt: RevisionAttempt;
  topic: Topic;
  onBack: () => void;
}) {
  const { dispatchV2 } = useStore();
  const problemById = new Map(topic.patterns.flatMap((p) => p.problems).map((p) => [p.id, p]));
  const allRated = attempt.questions.every((q) => q.confidence !== null);

  const submit = () => {
    if (!allRated) return;
    dispatchV2({ type: "SUBMIT_REVISION_SESSION", attemptId: attempt.id });
  };

  return (
    <div>
      <p className="text-[0.8rem] text-muted mb-3">
        How confident were you on each, before you saw anything else? This shapes what comes up more often next time.
      </p>
      {attempt.questions.length === 0 && (
        <p className="text-[0.8rem] text-muted mb-3">No questions to rate this session.</p>
      )}
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        return (
          <div key={q.questionId} className="mb-4">
            <div className="font-semibold text-[0.85rem] mb-1.5">{problem?.question ?? q.questionId}</div>
            <div className="flex gap-2 flex-wrap">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    dispatchV2({ type: "SAVE_QUESTION_CONFIDENCE", attemptId: attempt.id, questionId: q.questionId, confidence: opt.value })
                  }
                  className={cx(
                    "text-[0.8rem] px-2.5 py-1.5 border rounded-md cursor-pointer",
                    q.confidence === opt.value ? "border-fg bg-row-hover font-semibold" : "border-border bg-transparent text-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="text-[0.85rem] px-3 py-1.5 border-0 bg-transparent text-muted cursor-pointer">
          Back
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!allRated}
          className="text-[0.85rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit session
        </button>
      </div>
    </div>
  );
}
