import { useStore } from "../../context";
import { getV2Progress } from "../../store";
import type { RevisionAttempt, Topic } from "../../types";

const FIELD_CLASS =
  "w-full min-h-[50px] font-[inherit] text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base";

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
        <p className="text-[0.8rem] text-muted mb-3">No completed questions in this topic yet to recall.</p>
        <div className="flex gap-2">
          <BackButton onBack={onBack} />
          <button type="button" onClick={onNext} className="text-[0.85rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[0.8rem] text-muted mb-3">
        The stored solution and notes are hidden until you submit. Answer from memory.
      </p>
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        const progress = getV2Progress(v2Store, q.questionId);
        return (
          <div key={q.questionId} className="mb-5 border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              {problem?.link ? (
                <a href={problem.link} target="_blank" rel="noopener" className="font-semibold hover:underline">
                  {problem?.question ?? q.questionId}
                </a>
              ) : (
                <span className="font-semibold">{problem?.question ?? q.questionId}</span>
              )}
              {problem && <span className="text-[0.7rem] text-muted">{problem.difficulty}</span>}
            </div>
            {progress.mistakes.length > 0 && (
              <div className="text-[0.75rem] text-muted mb-2 bg-row-hover rounded-md p-2">
                Past mistakes on this one: {progress.mistakes.map((m) => m.what).join("; ")}
              </div>
            )}
            <div className="mb-2">
              <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Approach</label>
              <textarea
                defaultValue={q.approach}
                className={FIELD_CLASS}
                onBlur={(e) =>
                  dispatchV2({ type: "SAVE_QUESTION_RECALL", attemptId: attempt.id, questionId: q.questionId, field: "approach", value: e.target.value })
                }
              />
            </div>
            <div className="mb-2">
              <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Pseudocode</label>
              <textarea
                defaultValue={q.pseudocode}
                className={FIELD_CLASS}
                onBlur={(e) =>
                  dispatchV2({ type: "SAVE_QUESTION_RECALL", attemptId: attempt.id, questionId: q.questionId, field: "pseudocode", value: e.target.value })
                }
              />
            </div>
            <div className="mb-2">
              <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Complexity</label>
              <textarea
                defaultValue={q.complexity}
                className={FIELD_CLASS}
                onBlur={(e) =>
                  dispatchV2({ type: "SAVE_QUESTION_RECALL", attemptId: attempt.id, questionId: q.questionId, field: "complexity", value: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Edge cases (optional)</label>
              <textarea
                defaultValue={q.edgeCases}
                className={FIELD_CLASS}
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
          className="text-[0.85rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="text-[0.85rem] px-3 py-1.5 border-0 bg-transparent text-muted cursor-pointer">
      Back
    </button>
  );
}
