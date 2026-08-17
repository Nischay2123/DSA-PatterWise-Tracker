import { useState } from "react";
import { useStore } from "../context";
import { cx } from "../cx";
import { getV2Progress } from "../store";

const FIELD_CLASS =
  "w-full min-h-[36px] font-[inherit] text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base";

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
    <div className="border border-border rounded-lg p-2.5 mt-2 bg-row-hover">
      <div className="text-[0.8rem] font-semibold mb-2">
        Show your work before marking this done — pseudocode or code is required.
      </div>
      <div className="mb-2">
        <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Approach</label>
        <textarea
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
          onBlur={(e) => dispatchV2({ type: "SET_APPROACH", id: problemId, approach: e.target.value })}
          className={FIELD_CLASS}
        />
      </div>
      <div className="mb-2">
        <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Pseudocode</label>
        <textarea
          value={pseudocode}
          onChange={(e) => setPseudocode(e.target.value)}
          onBlur={(e) => dispatchV2({ type: "SET_PSEUDOCODE", id: problemId, pseudocode: e.target.value })}
          className={FIELD_CLASS}
        />
      </div>
      <div className="mb-2">
        <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Code</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={(e) => dispatchV2({ type: "SET_CODE", id: problemId, code: e.target.value })}
          className={cx("font-mono", FIELD_CLASS)}
        />
      </div>
      {!hasEvidence && (
        <div className="text-[0.75rem] text-muted mb-2">Add pseudocode or code to mark this question complete.</div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={markComplete}
          disabled={!hasEvidence}
          className="text-[0.85rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Mark complete
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[0.85rem] px-3 py-1.5 border-0 bg-transparent text-muted cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
