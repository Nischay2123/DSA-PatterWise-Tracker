import { useStore } from "../context";
import { cx } from "../cx";
import { getV2Progress } from "../store";

const FIELD_CLASS =
  "w-full min-h-[36px] font-[inherit] text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base";

// The persistent home for approach/pseudocode/code once a question is past
// the completion gate (or the gate never applied) -- "editable but not
// re-gated" (plan §7). CompletionPanel is the transient, blocking version of
// these same three fields shown only during a genuinely gated completion.
export function SolutionEditor({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);

  return (
    <div className="mb-2">
      <div>
        <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Approach</label>
        <textarea
          defaultValue={progress.approach}
          className={FIELD_CLASS}
          onBlur={(e) => dispatchV2({ type: "SET_APPROACH", id: problemId, approach: e.target.value })}
        />
      </div>
      <div className="mt-2">
        <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Pseudocode</label>
        <textarea
          defaultValue={progress.pseudocode}
          className={FIELD_CLASS}
          onBlur={(e) => dispatchV2({ type: "SET_PSEUDOCODE", id: problemId, pseudocode: e.target.value })}
        />
      </div>
      <div className="mt-2">
        <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Code</label>
        <textarea
          defaultValue={progress.code}
          className={cx("font-mono", FIELD_CLASS)}
          onBlur={(e) => dispatchV2({ type: "SET_CODE", id: problemId, code: e.target.value })}
        />
      </div>
    </div>
  );
}
