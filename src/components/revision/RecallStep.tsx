import { useStore } from "../../context";
import { getV2Progress } from "../../store";
import { cx } from "../../cx";

const BADGE_COLOR = { Easy: "bg-badge-easy", Medium: "bg-badge-medium", Hard: "bg-badge-hard" } as const;
import type { RevisionAttempt, Topic } from "../../types";


// approach/pseudocode/complexity are required to advance; edgeCases is
// explicitly optional (plan §8: "approach + pseudocode + complexity
// (+ optional edge cases)").
function isQuestionRecalled(q: RevisionAttempt["questions"][number]): boolean {
  return !!q.approach.trim() && !!q.pseudocode.trim() && !!q.complexity.trim();
}

export function RecallStep({
  attempt,
  topic,
  onBack,
  onNext,
}: {
  attempt: RevisionAttempt;
  topic: Topic;
  onBack: () => void;
  onNext: () => void;
}) {
  const { v2Store, dispatchV2 } = useStore();
  const problemById = new Map(topic.patterns.flatMap((p) => p.problems).map((p) => [p.id, p]));
  const allRecalled = attempt.questions.every(isQuestionRecalled);

  if (attempt.questions.length === 0) {
    return (
      <div>
        <p className="text-ui text-muted mb-4">No completed questions in this topic yet to recall.</p>
        <div className="flex gap-2">
          <BackButton onBack={onBack} />
          <button type="button" onClick={onNext} className="btn">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-ui text-muted mb-4">
        The stored solution and notes are hidden until you submit. Answer from memory.
      </p>
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        const progress = getV2Progress(v2Store, q.questionId);
        return (
          <div key={q.questionId} className="card p-3.5 mb-3">
            <div className="flex items-center gap-2 mb-2">
              {problem?.link ? (
                <a href={problem.link} target="_blank" rel="noopener" className="text-body font-semibold text-fg hover:text-accent hover:underline underline-offset-2">
                  {problem?.question ?? q.questionId}
                </a>
              ) : (
                <span className="text-body font-semibold">{problem?.question ?? q.questionId}</span>
              )}
              {problem && (
                <span className={cx("text-micro font-medium leading-none py-0.5 px-1.5 rounded text-white", BADGE_COLOR[problem.difficulty])}>
                  {problem.difficulty}
                </span>
              )}
            </div>
            {progress.mistakes.length > 0 && (
              <div className="text-caption text-muted mb-3 card-soft p-2.5">
                Past mistakes on this one: {progress.mistakes.map((m) => m.what).join("; ")}
              </div>
            )}
            <div className="mb-2">
              <label className="block text-micro font-semibold text-muted mb-0.5">Approach</label>
              <textarea
                defaultValue={q.approach}
                className="field"
              rows={2}
                onBlur={(e) =>
                  dispatchV2({ type: "SAVE_QUESTION_RECALL", attemptId: attempt.id, questionId: q.questionId, field: "approach", value: e.target.value })
                }
              />
            </div>
            <div className="mb-2">
              <label className="block text-micro font-semibold text-muted mb-0.5">Pseudocode</label>
              <textarea
                defaultValue={q.pseudocode}
                className="field"
              rows={2}
                onBlur={(e) =>
                  dispatchV2({ type: "SAVE_QUESTION_RECALL", attemptId: attempt.id, questionId: q.questionId, field: "pseudocode", value: e.target.value })
                }
              />
            </div>
            <div className="mb-2">
              <label className="block text-micro font-semibold text-muted mb-0.5">Complexity</label>
              <textarea
                defaultValue={q.complexity}
                className="field"
              rows={2}
                onBlur={(e) =>
                  dispatchV2({ type: "SAVE_QUESTION_RECALL", attemptId: attempt.id, questionId: q.questionId, field: "complexity", value: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-micro font-semibold text-muted mb-0.5">Edge cases (optional)</label>
              <textarea
                defaultValue={q.edgeCases}
                className="field"
              rows={2}
                onBlur={(e) =>
                  dispatchV2({ type: "SAVE_QUESTION_RECALL", attemptId: attempt.id, questionId: q.questionId, field: "edgeCases", value: e.target.value })
                }
              />
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <BackButton onBack={onBack} />
        <button
          type="button"
          onClick={onNext}
          disabled={!allRecalled}
          className="btn btn-primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="btn btn-quiet">
      Back
    </button>
  );
}
