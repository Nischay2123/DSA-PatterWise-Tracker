import { useStore } from "../../context";
import { getConceptById } from "../../revision/session";
import { getV2Progress } from "../../store";
import type { RevisionAttempt, Topic } from "../../types";

const CONFIDENCE_LABEL: Record<string, string> = { strong: "Strong", partial: "Partial", forgot: "Forgot" };

// Phase 6 ships no LLM (that's Phase 7) -- "self-assessment-only score" means
// exactly that: no computed pass/fail appears anywhere here. What the user
// gets is the same side-by-side reveal the plan specifies ("previous
// solution and notes revealed"), so they can judge their own answers.
export function ResultsStep({ topic, attempt, onExit }: { topic: Topic; attempt: RevisionAttempt; onExit: () => void }) {
  const { v2Store } = useStore();
  const problemById = new Map(topic.patterns.flatMap((p) => p.problems).map((p) => [p.id, p]));
  const tally = { strong: 0, partial: 0, forgot: 0 } as Record<string, number>;
  for (const q of attempt.questions) if (q.confidence) tally[q.confidence]++;

  return (
    <div className="max-w-[640px] mx-auto mt-6 px-5 pb-16">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[1.1rem] font-semibold m-0">Revision — {topic.name}</h1>
        <button type="button" onClick={onExit} className="text-[0.8rem] text-muted bg-transparent border-0 cursor-pointer underline">
          Back to tracker
        </button>
      </div>

      <div className="border border-border rounded-lg p-3 mb-5 text-[0.8rem]">
        <strong>Session saved.</strong> Automatic evaluation isn't available yet — that arrives with LLM grading in a
        later update. For now, compare your answers below against your own stored solutions and self-judge.
        {attempt.questions.length > 0 && (
          <div className="text-muted mt-1">
            Self-rated confidence: {tally.strong} strong · {tally.partial} partial · {tally.forgot} forgot
          </div>
        )}
      </div>

      <h2 className="text-[0.95rem] font-semibold mb-2">Fundamentals</h2>
      {attempt.fundamentals.map((f) => {
        const concept = getConceptById(f.conceptId);
        return (
          <div key={f.conceptId} className="mb-4 border border-border rounded-lg p-3">
            <div className="font-semibold text-[0.85rem] mb-1.5">{concept?.prompt ?? f.conceptId}</div>
            <div className="text-[0.8rem] mb-2">
              <span className="text-muted">Your answer: </span>
              {f.answer || <span className="text-muted italic">(left blank)</span>}
            </div>
            {concept && (
              <div className="text-[0.75rem] text-muted">
                Should cover: {concept.expectedConcepts.join("; ")}
              </div>
            )}
          </div>
        );
      })}

      {attempt.questions.length > 0 && <h2 className="text-[0.95rem] font-semibold mb-2 mt-5">Questions</h2>}
      {attempt.questions.map((q) => {
        const problem = problemById.get(q.questionId);
        const progress = getV2Progress(v2Store, q.questionId);
        return (
          <div key={q.questionId} className="mb-5 border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">{problem?.question ?? q.questionId}</span>
              {q.confidence && <span className="text-[0.7rem] text-muted">{CONFIDENCE_LABEL[q.confidence]}</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[0.8rem]">
              <div>
                <div className="text-[0.7rem] font-semibold text-muted mb-1">Your recall</div>
                <div className="mb-1.5"><span className="text-muted">Approach: </span>{q.approach || "—"}</div>
                <div className="mb-1.5"><span className="text-muted">Pseudocode: </span>{q.pseudocode || "—"}</div>
                <div className="mb-1.5"><span className="text-muted">Complexity: </span>{q.complexity || "—"}</div>
                {q.edgeCases && <div><span className="text-muted">Edge cases: </span>{q.edgeCases}</div>}
              </div>
              <div>
                <div className="text-[0.7rem] font-semibold text-muted mb-1">Your stored solution</div>
                <div className="mb-1.5"><span className="text-muted">Approach: </span>{progress.approach || "—"}</div>
                <div className="mb-1.5"><span className="text-muted">Pseudocode: </span>{progress.pseudocode || "—"}</div>
                {progress.code && (
                  <pre className="whitespace-pre-wrap font-mono text-[0.75rem] bg-row-hover rounded-md p-1.5">{progress.code}</pre>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
