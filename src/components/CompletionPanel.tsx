import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";
import { ERROR_MESSAGE } from "../llm/client";
import { canGradeSolutions, gradeSolution, type SolutionAttempt, type SolutionVerdict } from "../llm/gradeSolution";
import { generateNotes, notesToApply } from "../llm/notes";
import type { Problem } from "../types";
import { Icon } from "./Icon";
import { REVISION_CONFIG } from "../config";

// Shown only when a completion is actually gated (never-yet-completed, and
// settings.requireEvidence is on) -- see canCompleteFreely in store.ts.
// Marking done otherwise stays an instant toggle, exactly as before.
//
// With an API key set, the box is also graded: a non-empty box used to be
// the whole gate, so "abc" passed it. Without a key it stays the old
// presence check rather than becoming unusable.
const PASS_SCORE = REVISION_CONFIG.passScore;

export function CompletionPanel({
  problem,
  topicName,
  patternName,
  onCancel,
  onCompleted,
}: {
  problem: Problem;
  topicName: string;
  patternName: string;
  onCancel: () => void;
  onCompleted: () => void;
}) {
  const problemId = problem.id;
  const { v2Store, dispatch, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);
  const [approach, setApproach] = useState(progress.approach);
  const [pseudocode, setPseudocode] = useState(progress.pseudocode);
  const [code, setCode] = useState(progress.code);
  const [grading, setGrading] = useState(false);
  const [writingNotes, setWritingNotes] = useState(false);
  const [verdict, setVerdict] = useState<SolutionVerdict | null>(null);

  const hasEvidence = !!approach.trim() && (!!pseudocode.trim() || !!code.trim());
  const graded = canGradeSolutions(v2Store.settings);

  // Flush the current draft explicitly rather than relying solely on blur
  // having already fired -- guarantees no evidence is lost at submit time,
  // including when grading then fails or rejects the answer.
  const persist = () => {
    dispatchV2({ type: "SET_APPROACH", id: problemId, approach });
    dispatchV2({ type: "SET_PSEUDOCODE", id: problemId, pseudocode });
    dispatchV2({ type: "SET_CODE", id: problemId, code });
  };

  const finish = () => {
    persist();
    dispatch({ type: "TOGGLE_DONE", id: problemId, done: true });
    onCompleted();
  };

  // Notes are written for you once the solution is accepted, so the six
  // fields exist without being typed twice. Only ever into empty fields --
  // see notesToApply. The mistake list is yours alone and is never touched.
  const writeNotes = async (attempt: SolutionAttempt) => {
    setWritingNotes(true);
    const result = await generateNotes(v2Store.settings, attempt);
    setWritingNotes(false);
    if (!result.ok) return; // notes are a bonus, never a reason to hold up a passed solution
    for (const { field, value } of notesToApply(progress.notes, result.data)) {
      dispatchV2({ type: "SET_STRUCTURED_NOTE", id: problemId, field, value });
    }
  };

  const markComplete = async () => {
    if (!hasEvidence || grading || writingNotes) return;
    persist();
    if (!graded) return finish();

    const attempt: SolutionAttempt = {
      questionId: problemId,
      title: problem.question,
      patternName,
      difficulty: problem.difficulty,
      topicName,
      approach,
      pseudocode,
      code,
    };

    setGrading(true);
    setVerdict(null);
    const result = await gradeSolution(v2Store.settings, attempt);
    setGrading(false);
    setVerdict(result);
    if (result.kind !== "pass") return;

    await writeNotes(attempt);
    finish();
  };

  return (
    <div className="mt-2 rounded-lg border border-accent-line bg-accent-soft p-3.5">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
          <Icon name="target" className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-body font-bold">Show your work first</div>
          <div className="text-caption text-muted">
            {graded
              ? "Your solution is graded before this is marked done, then your notes are written for you."
              : "An approach, plus pseudocode or code, is required to mark this done."}
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label">Approach</label>
          <textarea
            value={approach}
            onChange={(e) => setApproach(e.target.value)}
            onBlur={(e) => dispatchV2({ type: "SET_APPROACH", id: problemId, approach: e.target.value })}
            className="field resize-y"
            rows={2}
          />
        </div>
        <div>
          <label className="field-label">Pseudocode</label>
          <textarea
            value={pseudocode}
            onChange={(e) => setPseudocode(e.target.value)}
            onBlur={(e) => dispatchV2({ type: "SET_PSEUDOCODE", id: problemId, pseudocode: e.target.value })}
            className="field resize-y font-mono text-caption"
            rows={4}
          />
        </div>
        <div>
          <label className="field-label">Code</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={(e) => dispatchV2({ type: "SET_CODE", id: problemId, code: e.target.value })}
            className="field resize-y font-mono text-caption"
            rows={4}
          />
        </div>
      </div>

      {verdict?.kind === "fail" && (
        <div className="mt-3 rounded-lg border border-hard bg-hard-soft p-3">
          <div className="text-caption font-bold text-hard">
            Not there yet — scored {verdict.score}/100 (need {PASS_SCORE})
          </div>
          {verdict.note && <p className="text-caption text-muted mt-1.5 mb-0">{verdict.note}</p>}
          {verdict.mistakes.length > 0 && (
            <ul className="text-caption text-muted mt-1.5 mb-0 pl-4 list-disc">
              {verdict.mistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {verdict?.kind === "ungraded" && (
        <div className="mt-3 rounded-lg border border-accent-line bg-accent-soft p-3">
          <div className="text-caption font-bold">Couldn't grade this</div>
          <p className="text-caption text-muted mt-1.5 mb-0">
            {ERROR_MESSAGE[verdict.error]} Your work is saved. Marking it done is your call.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          type="button"
          onClick={markComplete}
          disabled={!hasEvidence || grading || writingNotes}
          className="btn btn-primary"
        >
          <Icon name={grading || writingNotes ? "clock" : "check"} className="size-4" />
          {grading
            ? "Grading…"
            : writingNotes
              ? "Writing your notes…"
              : verdict?.kind === "fail"
                ? "Check again"
                : "Mark complete"}
        </button>
        {/* A provider that couldn't be reached is not evidence about the
            solution, so the decision goes back to the user rather than the
            checkbox staying locked. A graded fail has no such override --
            the Settings switch is the release valve for that. */}
        {verdict?.kind === "ungraded" && (
          <button type="button" onClick={finish} className="btn btn-quiet">
            Mark done anyway
          </button>
        )}
        <button type="button" onClick={onCancel} className="btn btn-quiet">
          Cancel
        </button>
        {!hasEvidence && (
          <span className="text-caption text-muted">
            {approach.trim() ? "Add pseudocode or code to enable this." : "Add your approach, plus pseudocode or code, to enable this."}
          </span>
        )}
      </div>
    </div>
  );
}
