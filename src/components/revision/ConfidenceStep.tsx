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
      <p className="text-ui text-muted mb-4">
        How confident were you on each, before you saw anything else? This shapes what comes up more often next time.
      </p>
      {attempt.questions.length === 0 && (
        <p className="text-ui text-muted mb-4">No questions to rate this session.</p>
      )}
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        return (
          <div key={q.questionId} className="card p-3.5 mb-3">
            <div className="font-semibold text-body mb-2.5">{problem?.question ?? q.questionId}</div>
            <div className="flex gap-2 flex-wrap">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    dispatchV2({ type: "SAVE_QUESTION_CONFIDENCE", attemptId: attempt.id, questionId: q.questionId, confidence: opt.value })
                  }
                  className={cx("btn btn-sm", q.confidence === opt.value && "btn-primary")}
                  aria-pressed={q.confidence === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="btn btn-quiet">
          Back
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!allRated}
          className="btn btn-primary"
        >
          Submit session
        </button>
      </div>
    </div>
  );
}
