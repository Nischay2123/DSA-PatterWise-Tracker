import { useStore } from "../../context";
import { cx } from "../../cx";
import { Icon, type IconName } from "../Icon";
import type { RevisionAttempt, Topic } from "../../types";

const OPTIONS: { value: "strong" | "partial" | "forgot"; label: string; hint: string; icon: IconName; on: string }[] = [
  { value: "strong", label: "Strong", hint: "Nailed it", icon: "check", on: "border-easy bg-easy-soft text-easy" },
  { value: "partial", label: "Partial", hint: "Got most of it", icon: "target", on: "border-medium bg-medium-soft text-medium" },
  { value: "forgot", label: "Forgot", hint: "Mostly blanked", icon: "alert", on: "border-hard bg-hard-soft text-hard" },
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
      <p className="card-inset p-3 text-ui text-muted mb-4 flex items-start gap-2">
        <Icon name="sparkle" className="size-4 shrink-0 mt-px text-accent" />
        How confident were you on each, before you saw anything else? This shapes what comes up more often next time.
      </p>
      {attempt.questions.length === 0 && (
        <p className="card-inset p-3 text-ui text-muted mb-4">No questions to rate this session.</p>
      )}
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        return (
          <div key={q.questionId} className="card p-4 mb-3">
            <div className="font-semibold text-body mb-3">{problem?.question ?? q.questionId}</div>
            {/* Three equal targets instead of three text buttons of unequal
                width — the choice is a scale, so it should look like one. */}
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS.map((opt) => {
                const on = q.confidence === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      dispatchV2({ type: "SAVE_QUESTION_CONFIDENCE", attemptId: attempt.id, questionId: q.questionId, confidence: opt.value })
                    }
                    className={cx(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 cursor-pointer transition-colors",
                      on ? opt.on : "border-border bg-bg text-muted hover:border-border-strong hover:text-fg"
                    )}
                    aria-pressed={on}
                  >
                    <Icon name={opt.icon} className="size-4" />
                    <span className="text-ui font-semibold leading-none">{opt.label}</span>
                    <span className="text-micro opacity-80 leading-none text-center">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="btn btn-quiet">
          <Icon name="chevronLeft" className="size-4" />
          Back
        </button>
        <button type="button" onClick={submit} disabled={!allRated} className="btn btn-primary">
          <Icon name="sparkle" className="size-4" />
          Submit session
        </button>
      </div>
    </div>
  );
}
