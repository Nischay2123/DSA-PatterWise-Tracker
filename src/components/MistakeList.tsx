import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";

const INPUT_CLASS = "w-full text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg";

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
      <div className="text-[0.7rem] font-semibold text-muted mb-1">Mistakes</div>
      {progress.mistakes.length > 0 && (
        <ul className="m-0 mb-2 p-0 list-none">
          {progress.mistakes.map((m) => (
            <li key={m.at} className="flex items-start gap-2 text-[0.8rem] border-t border-border py-1.5 first:border-t-0">
              <div className="flex-1 min-w-0">
                <div>{m.what}</div>
                {m.remember && <div className="text-muted">{m.remember}</div>}
                <div className="text-[0.7rem] text-muted">{m.at.slice(0, 10)}</div>
              </div>
              <button
                type="button"
                className="bg-transparent border-0 cursor-pointer text-muted text-[0.75rem]"
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
          className={INPUT_CLASS}
        />
        <input
          type="text"
          placeholder="What to remember next time (optional)"
          value={remember}
          onChange={(e) => setRemember(e.target.value)}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          onClick={addMistake}
          disabled={!what.trim()}
          className="self-start text-[0.8rem] px-3 py-1 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add mistake
        </button>
      </div>
    </div>
  );
}
