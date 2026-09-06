import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";
import { Icon } from "./Icon";

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
    <div className="mb-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="alert" className="size-3.5 text-faint" />
        <span className="text-ui font-bold">Mistakes</span>
        {progress.mistakes.length > 0 && <span className="chip py-0.5 px-1.5">{progress.mistakes.length}</span>}
      </div>

      {progress.mistakes.length > 0 && (
        <ul className="m-0 mb-2.5 p-0 list-none flex flex-col gap-1.5">
          {progress.mistakes.map((m) => (
            <li
              key={m.at}
              className="group/mistake card-inset flex items-start gap-2 p-2.5 border-l-2 border-l-hard"
            >
              <div className="flex-1 min-w-0">
                <div className="text-ui font-medium">{m.what}</div>
                {m.remember && (
                  <div className="text-caption text-muted mt-0.5 flex items-start gap-1">
                    <Icon name="arrowRight" className="size-3 mt-0.5 shrink-0" />
                    {m.remember}
                  </div>
                )}
                <div className="text-micro text-faint mt-1 tabular-nums">{m.at.slice(0, 10)}</div>
              </div>
              <button
                type="button"
                className="icon-btn size-6 shrink-0 opacity-0 group-hover/mistake:opacity-100
                  focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100 hover:text-hard"
                title="Remove this mistake"
                aria-label="Remove mistake"
                onClick={() => dispatchV2({ type: "REMOVE_MISTAKE", id: problemId, at: m.at })}
              >
                <Icon name="trash" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
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
        <button type="button" onClick={addMistake} disabled={!what.trim()} className="btn shrink-0">
          <Icon name="plus" className="size-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
