import { useState } from "react";
import type { KeyboardEvent } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";
import { Icon } from "./Icon";
import { rowsFor } from "./NotesEditor";

type Draft = { what: string; remember: string };

// Two multi-line boxes that grow with their text. Ctrl/⌘+Enter saves.
function MistakeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (d: Draft) => void;
  onCancel?: () => void;
}) {
  const [what, setWhat] = useState(initial.what);
  const [remember, setRemember] = useState(initial.remember);
  const submit = () => {
    if (!what.trim()) return;
    onSubmit({ what: what.trim(), remember: remember.trim() });
    setWhat("");
    setRemember("");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") onCancel?.();
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="block">
        <span className="field-label">What went wrong</span>
        <textarea
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          onKeyDown={onKey}
          rows={rowsFor(what)}
          placeholder="e.g. Forgot the window can shrink to zero, so left overtook right"
          className="field resize-y"
          autoFocus={!!onCancel}
        />
      </label>
      <label className="block">
        <span className="field-label">What to remember next time (optional)</span>
        <textarea
          value={remember}
          onChange={(e) => setRemember(e.target.value)}
          onKeyDown={onKey}
          rows={rowsFor(remember)}
          placeholder="e.g. Shrink while invalid, then update the answer"
          className="field resize-y"
        />
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={submit} disabled={!what.trim()} className="btn btn-sm">
          <Icon name={onCancel ? "check" : "plus"} className="size-3.5" />
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-quiet btn-sm">
            Cancel
          </button>
        )}
        <span className="text-micro text-faint max-sm:hidden">Ctrl/⌘ + Enter to save</span>
      </div>
    </div>
  );
}

export function MistakeList({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="alert" className="size-3.5 text-faint" />
        <span className="text-ui font-bold">Mistakes</span>
        {progress.mistakes.length > 0 && <span className="chip py-0.5 px-1.5">{progress.mistakes.length}</span>}
      </div>

      {progress.mistakes.length > 0 && (
        <ul className="m-0 mb-3 p-0 list-none flex flex-col gap-1.5">
          {progress.mistakes.map((m) => (
            <li key={m.at} className="group/mistake card-inset p-2.5 border-l-2 border-l-hard">
              {editing === m.at ? (
                <MistakeForm
                  initial={m}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={(d) => {
                    dispatchV2({ type: "UPDATE_MISTAKE", id: problemId, at: m.at, ...d });
                    setEditing(null);
                  }}
                />
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {/* pre-wrap keeps the line breaks you typed */}
                    <div className="text-ui font-medium whitespace-pre-wrap break-words">{m.what}</div>
                    {m.remember && (
                      <div className="text-caption text-muted mt-1 flex items-start gap-1">
                        <Icon name="arrowRight" className="size-3 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-wrap break-words min-w-0">{m.remember}</span>
                      </div>
                    )}
                    <div className="text-micro text-faint mt-1 tabular-nums">{m.at.slice(0, 10)}</div>
                  </div>
                  <span
                    className="flex shrink-0 opacity-0 group-hover/mistake:opacity-100 group-focus-within/mistake:opacity-100
                      [@media(pointer:coarse)]:opacity-100"
                  >
                    <button
                      type="button"
                      className="icon-btn size-6 hover:text-accent"
                      title="Edit this mistake"
                      aria-label="Edit mistake"
                      onClick={() => setEditing(m.at)}
                    >
                      <Icon name="pencil" className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn size-6 hover:text-hard"
                      title="Remove this mistake"
                      aria-label="Remove mistake"
                      onClick={() => dispatchV2({ type: "REMOVE_MISTAKE", id: problemId, at: m.at })}
                    >
                      <Icon name="trash" className="size-3.5" />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <MistakeForm
        initial={{ what: "", remember: "" }}
        submitLabel="Add mistake"
        // Full timestamp, not just the day -- two mistakes logged the same day
        // must still get distinct `at` values, since that's the edit/removal key.
        onSubmit={(d) => dispatchV2({ type: "ADD_MISTAKE", id: problemId, mistake: { at: new Date().toISOString(), ...d } })}
      />
    </div>
  );
}
