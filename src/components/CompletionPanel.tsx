import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";


// Shown only when a completion is actually gated (never-yet-completed, and
// settings.requireEvidence is on) -- see canCompleteFreely in store.ts.
// Marking done otherwise stays an instant toggle, exactly as before.
export function CompletionPanel({
  problemId,
  onCancel,
  onCompleted,
}: {
  problemId: string;
  onCancel: () => void;
  onCompleted: () => void;
}) {
  const { v2Store, dispatch, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);
  const [approach, setApproach] = useState(progress.approach);
  const [pseudocode, setPseudocode] = useState(progress.pseudocode);
  const [code, setCode] = useState(progress.code);

  const hasEvidence = !!pseudocode.trim() || !!code.trim();

  const markComplete = () => {
    if (!hasEvidence) return;
    // Flush the current draft explicitly rather than relying solely on blur
    // having already fired -- guarantees no evidence is lost at submit time.
    dispatchV2({ type: "SET_APPROACH", id: problemId, approach });
    dispatchV2({ type: "SET_PSEUDOCODE", id: problemId, pseudocode });
    dispatchV2({ type: "SET_CODE", id: problemId, code });
    dispatch({ type: "TOGGLE_DONE", id: problemId, done: true });
    onCompleted();
  };

  return (
    <div className="card-soft p-3.5 mt-2">
      <div className="text-body font-semibold mb-3">
        Show your work before marking this done — pseudocode or code is required.
      </div>
      <div className="mb-2">
        <label className="field-label">Approach</label>
        <textarea
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
          onBlur={(e) => dispatchV2({ type: "SET_APPROACH", id: problemId, approach: e.target.value })}
          className="field"
              rows={2}
        />
      </div>
      <div className="mb-2">
        <label className="field-label">Pseudocode</label>
        <textarea
          value={pseudocode}
          onChange={(e) => setPseudocode(e.target.value)}
          onBlur={(e) => dispatchV2({ type: "SET_PSEUDOCODE", id: problemId, pseudocode: e.target.value })}
          className="field"
              rows={2}
        />
      </div>
      <div className="mb-2">
        <label className="field-label">Code</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={(e) => dispatchV2({ type: "SET_CODE", id: problemId, code: e.target.value })}
          className="field font-mono"
              rows={2}
        />
      </div>
      {!hasEvidence && (
        <div className="text-caption text-muted mb-2.5">Add pseudocode or code to mark this question complete.</div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={markComplete}
          disabled={!hasEvidence}
          className="btn btn-primary"
        >
          Mark complete
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-quiet"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
