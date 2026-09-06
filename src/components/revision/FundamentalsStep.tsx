import { useStore } from "../../context";
import { getConceptById } from "../../revision/session";
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
      <p className="text-ui text-muted mb-4">
        Answer each from memory, in your own words. You'll compare against the source concepts after submitting.
      </p>
      {attempt.fundamentals.map((f) => {
        const concept = getConceptById(f.conceptId);
        return (
          <div key={f.conceptId} className="card p-3.5 mb-3">
            <label className="block text-body font-semibold mb-2">{concept?.prompt ?? f.conceptId}</label>
            <textarea
              defaultValue={f.answer}
              className="field"
              rows={3}
              onBlur={(e) =>
                dispatchV2({ type: "SAVE_FUNDAMENTAL_ANSWER", attemptId: attempt.id, conceptId: f.conceptId, answer: e.target.value })
              }
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={onNext}
        disabled={!allAnswered}
        className="btn btn-primary"
      >
        Continue
      </button>
    </div>
  );
}
