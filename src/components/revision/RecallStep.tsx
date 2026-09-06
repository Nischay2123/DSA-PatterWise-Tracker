import { useStore } from "../../context";
import { getV2Progress } from "../../store";
import { cx } from "../../cx";
import { Icon } from "../Icon";
import { DIFFICULTY_PILL } from "../QuestionRow";
import type { RevisionAttempt, Topic } from "../../types";

const RECALL_FIELDS = [
  { key: "approach" as const, label: "Approach", mono: false, rows: 3 },
  { key: "pseudocode" as const, label: "Pseudocode", mono: true, rows: 4 },
  { key: "complexity" as const, label: "Complexity", mono: false, rows: 2 },
  { key: "edgeCases" as const, label: "Edge cases (optional)", mono: false, rows: 2 },
];

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
        <p className="card-inset p-3 text-ui text-muted mb-4">No completed questions in this topic yet to recall.</p>
        <div className="flex gap-2">
          <BackButton onBack={onBack} />
          <button type="button" onClick={onNext} className="btn">
            Continue
            <Icon name="arrowRight" className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="card-inset p-3 text-ui text-muted mb-4 flex items-start gap-2">
        <Icon name="target" className="size-4 shrink-0 mt-px text-accent" />
        The stored solution and notes are hidden until you submit. Answer from memory.
      </p>
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        const progress = getV2Progress(v2Store, q.questionId);
        const recalled = isQuestionRecalled(q);
        return (
          <div key={q.questionId} className="card p-4 mb-3">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {problem && (
                <span className={cx("pill px-1.5 font-bold shrink-0", DIFFICULTY_PILL[problem.difficulty])}>
                  {problem.difficulty}
                </span>
              )}
              {problem?.link ? (
                <a
                  href={problem.link}
                  target="_blank"
                  rel="noopener"
                  className="text-body font-semibold text-fg hover:text-accent hover:underline underline-offset-2 inline-flex items-center gap-1"
                >
                  {problem?.question ?? q.questionId}
                  <Icon name="external" className="size-3 shrink-0" />
                </a>
              ) : (
                <span className="text-body font-semibold">{problem?.question ?? q.questionId}</span>
              )}
              {recalled && (
                <span className="ml-auto grid size-5 place-items-center rounded-full bg-accent text-accent-fg shrink-0">
                  <Icon name="check" className="size-3" />
                </span>
              )}
            </div>

            {progress.mistakes.length > 0 && (
              <div className="mb-3 rounded-lg border border-l-2 border-border border-l-star bg-star-soft/40 p-2.5">
                <div className="field-label mb-1 text-star">Past mistakes on this one</div>
                <div className="text-caption text-muted">{progress.mistakes.map((m) => m.what).join("; ")}</div>
              </div>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2">
              {RECALL_FIELDS.map((f) => (
                <div key={f.key} className={f.key === "approach" ? "sm:col-span-2" : undefined}>
                  <label className="field-label">{f.label}</label>
                  <textarea
                    defaultValue={q[f.key]}
                    className={cx("field resize-y", f.mono && "font-mono text-caption")}
                    rows={f.rows}
                    onBlur={(e) =>
                      dispatchV2({
                        type: "SAVE_QUESTION_RECALL",
                        attemptId: attempt.id,
                        questionId: q.questionId,
                        field: f.key,
                        value: e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <BackButton onBack={onBack} />
        <button type="button" onClick={onNext} disabled={!allRecalled} className="btn btn-primary">
          Continue
          <Icon name="arrowRight" className="size-4" />
        </button>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="btn btn-quiet">
      <Icon name="chevronLeft" className="size-4" />
      Back
    </button>
  );
}
