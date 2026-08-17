import { useStore } from "../../context";
import { getConceptById } from "../../revision/session";
import type { RevisionAttempt } from "../../types";

const FIELD_CLASS =
  "w-full min-h-[70px] font-[inherit] text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base";

// Active recall, blind -- no expectedConcepts shown here. Those only appear
// in ResultsStep, for the user to self-check against after answering from
// memory (plan §8: "Only after submit are the previous solution and notes
// revealed").
export function FundamentalsStep({ attempt, onNext }: { attempt: RevisionAttempt; onNext: () => void }) {
  const { dispatchV2 } = useStore();
  const allAnswered = attempt.fundamentals.every((f) => f.answer.trim().length > 0);

  return (
    <div>
      <p className="text-[0.8rem] text-muted mb-3">
        Answer each from memory, in your own words. You'll compare against the source concepts after submitting.
      </p>
      {attempt.fundamentals.map((f) => {
        const concept = getConceptById(f.conceptId);
        return (
          <div key={f.conceptId} className="mb-4">
            <label className="block text-[0.8rem] font-semibold mb-1">{concept?.prompt ?? f.conceptId}</label>
            <textarea
              defaultValue={f.answer}
              className={FIELD_CLASS}
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
        className="text-[0.85rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  );
}
