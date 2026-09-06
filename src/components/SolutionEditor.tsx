import { useStore } from "../context";
import { getV2Progress } from "../store";
import { Icon } from "./Icon";

// The persistent home for approach/pseudocode/code once a question is past
// the completion gate (or the gate never applied) -- "editable but not
// re-gated" (plan §7). CompletionPanel is the transient, blocking version of
// these same three fields shown only during a genuinely gated completion.
export function SolutionEditor({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="target" className="size-3.5 text-faint" />
        <span className="text-ui font-bold">Solution</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <label className="field-label">Approach</label>
          <textarea
            defaultValue={progress.approach}
            className="field resize-y"
            rows={3}
            onBlur={(e) => dispatchV2({ type: "SET_APPROACH", id: problemId, approach: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Pseudocode</label>
          <textarea
            defaultValue={progress.pseudocode}
            className="field resize-y font-mono text-caption"
            rows={3}
            onBlur={(e) => dispatchV2({ type: "SET_PSEUDOCODE", id: problemId, pseudocode: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Code</label>
          <textarea
            defaultValue={progress.code}
            className="field resize-y font-mono text-caption"
            rows={5}
            onBlur={(e) => dispatchV2({ type: "SET_CODE", id: problemId, code: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
