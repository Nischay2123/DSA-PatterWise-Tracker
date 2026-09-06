import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";


export function MistakeList({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);
  const [what, setWhat] = useState("");
  const [remember, setRemember] = useState("");

  const addMistake = () => {
    if (!what.trim()) return;
    // Full timestamp, not just the day -- two mistakes logged the same day
    // must still get distinct `at` values, since that's the removal key.
    dispatchV2({
      type: "ADD_MISTAKE",
      id: problemId,
      mistake: { at: new Date().toISOString(), what: what.trim(), remember: remember.trim() },
    });
    setWhat("");
    setRemember("");
  };

  return (
    <div>
      <div className="field-label">Mistakes</div>
      {progress.mistakes.length > 0 && (
        <ul className="m-0 mb-2 p-0 list-none">
          {progress.mistakes.map((m) => (
            <li key={m.at} className="flex items-start gap-2 text-ui border-t border-border py-2 first:border-t-0">
              <div className="flex-1 min-w-0">
                <div>{m.what}</div>
                {m.remember && <div className="text-muted">{m.remember}</div>}
                <div className="text-micro text-muted">{m.at.slice(0, 10)}</div>
              </div>
              <button
                type="button"
                className="btn-link text-caption text-muted ml-auto shrink-0"
                onClick={() => dispatchV2({ type: "REMOVE_MISTAKE", id: problemId, at: m.at })}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          placeholder="What went wrong?"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          className="field"
        />
        <input
          type="text"
          placeholder="What to remember next time (optional)"
          value={remember}
          onChange={(e) => setRemember(e.target.value)}
          className="field"
        />
        <button
          type="button"
          onClick={addMistake}
          disabled={!what.trim()}
          className="btn btn-sm self-start"
        >
          Add mistake
        </button>
      </div>
    </div>
  );
}
