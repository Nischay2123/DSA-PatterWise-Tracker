import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";
import { Icon } from "./Icon";

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
    <div className="mt-2 rounded-lg border border-accent-line bg-accent-soft p-3.5">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
          <Icon name="target" className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-body font-bold">Show your work first</div>
          <div className="text-caption text-muted">Pseudocode or code is required to mark this done.</div>
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

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button type="button" onClick={markComplete} disabled={!hasEvidence} className="btn btn-primary">
          <Icon name="check" className="size-4" />
          Mark complete
        </button>
        <button type="button" onClick={onCancel} className="btn btn-quiet">
          Cancel
        </button>
        {!hasEvidence && (
          <span className="text-caption text-muted">Add pseudocode or code to enable this.</span>
        )}
      </div>
    </div>
  );
}
