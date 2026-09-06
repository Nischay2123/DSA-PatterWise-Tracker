import { useStore } from "../../context";
import { getConceptById } from "../../revision/session";
import { Icon } from "../Icon";
import type { RevisionAttempt } from "../../types";

// Active recall, blind -- no expectedConcepts shown here. Those only appear
// in ResultsStep, for the user to self-check against after answering from
// memory (plan §8: "Only after submit are the previous solution and notes
// revealed").
export function FundamentalsStep({ attempt, onNext }: { attempt: RevisionAttempt; onNext: () => void }) {
  const { dispatchV2 } = useStore();
  const allAnswered = attempt.fundamentals.every((f) => f.answer.trim().length > 0);

  return (
    <div>
      <p className="card-inset p-3 text-ui text-muted mb-4 flex items-start gap-2">
        <Icon name="brain" className="size-4 shrink-0 mt-px text-accent" />
        Answer each from memory, in your own words. You'll compare against the source concepts after submitting.
      </p>
      {attempt.fundamentals.map((f, i) => {
        const concept = getConceptById(f.conceptId);
        return (
          <div key={f.conceptId} className="card p-4 mb-3">
            <label className="flex items-start gap-2.5 mb-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent text-[10px] font-bold">
                {i + 1}
              </span>
              <span className="text-body font-semibold">{concept?.prompt ?? f.conceptId}</span>
            </label>
            <textarea
              defaultValue={f.answer}
              className="field resize-y"
              rows={3}
              onBlur={(e) =>
                dispatchV2({ type: "SAVE_FUNDAMENTAL_ANSWER", attemptId: attempt.id, conceptId: f.conceptId, answer: e.target.value })
              }
            />
          </div>
        );
      })}
      <button type="button" onClick={onNext} disabled={!allAnswered} className="btn btn-primary">
        Continue
        <Icon name="arrowRight" className="size-4" />
      </button>
    </div>
  );
}
