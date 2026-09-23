import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress } from "../store";
import { cx } from "../cx";
import { Icon } from "./Icon";
import type { StructuredNoteField } from "../types";

// These notes are written once and read months later, usually in the ten
// seconds before deciding "do I still know this?". So the panel reads first
// and edits second: six two-row textareas in two columns was a form that
// happened to contain prose, and prose in a 2-row box is unreadable.
//
// The six fields are not six of the same thing, so they are not six identical
// cards. They are the order you re-learn a problem in -- what it does, why it
// works, what bites, what it costs, what you told yourself -- and each one is
// shaped like what it holds:
type Tone =
  | "prose" // the explanation: plain paragraphs, reading measure
  | "warn" // the traps: ruled down the left so they're findable at a glance
  | "fact" // complexity: notation, not prose, so it is set as notation
  | "mine"; // the reminder: tinted, because it is addressed to you

const FIELDS: { key: StructuredNoteField; label: string; tone: Tone }[] = [
  { key: "approach", label: "Approach", tone: "prose" },
  { key: "keyInsight", label: "Key insight", tone: "prose" },
  { key: "commonMistake", label: "Common mistake", tone: "warn" },
  { key: "edgeCases", label: "Edge cases", tone: "warn" },
  { key: "complexity", label: "Complexity", tone: "fact" },
  { key: "reminder", label: "Reminder", tone: "mine" },
];

// Sized to its content so nothing is read through a two-line slot, capped so
// one long note can't push the buttons off screen.
export function rowsFor(value: string): number {
  const lines = value.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 58)), 0);
  return Math.min(14, Math.max(3, lines + 1));
}

// A reading measure, in rem rather than ch: `ch` resolves against the
// container's inherited 16px, not the 14px the prose is actually set in, which
// lands at ~95 characters a line. 27rem is ~68 at this size.
const MEASURE = "max-w-[27rem]";

function Heading({ label, action }: { label: string; action: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-1">
      <span className="text-caption font-semibold text-muted">{label}</span>
      {action}
    </div>
  );
}

export function NotesEditor({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);
  const [editing, setEditing] = useState<StructuredNoteField | null>(null);

  const save = (field: StructuredNoteField, value: string) => {
    dispatchV2({ type: "SET_STRUCTURED_NOTE", id: problemId, field, value });
    setEditing(null);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon name="book" className="size-3.5 text-faint" />
        <span className="text-ui font-bold">Notes</span>
      </div>

      {progress.notes.legacy.trim() && (
        <div className="card-inset p-3 mb-4">
          <div className="text-caption font-semibold text-muted mb-1">Previous notes</div>
          <p className="text-body text-muted whitespace-pre-wrap m-0 max-w-[27rem]">{progress.notes.legacy}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {FIELDS.map(({ key, label, tone }) => {
          const value = progress.notes[key];

          if (editing === key) {
            return (
              <div key={key} className={MEASURE}>
                <Heading label={label} action={<span className="text-micro text-faint">Click away to save</span>} />
                <textarea
                  autoFocus
                  defaultValue={value}
                  rows={rowsFor(value)}
                  className={cx("field resize-y leading-relaxed", tone === "fact" && "font-mono text-caption")}
                  onBlur={(e) => save(key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null); // abandon without saving
                  }}
                />
              </div>
            );
          }

          if (!value.trim()) {
            return (
              <div key={key} className={cx(MEASURE, "flex items-baseline justify-between gap-3")}>
                <span className="text-caption font-semibold text-faint">{label}</span>
                <button type="button" className="btn-link text-caption" onClick={() => setEditing(key)}>
                  Add
                </button>
              </div>
            );
          }

          const edit = (
            <button type="button" className="btn-link text-micro" onClick={() => setEditing(key)}>
              Edit
            </button>
          );

          // Bare notation sits on one line next to its label -- a paragraph
          // block around "O(n^2) time, O(n) stack" is chrome around eight
          // characters of information. Once there's a sentence explaining the
          // why, it is prose and is set as prose: mono wrapped over three
          // lines is harder to read, not more precise.
          if (tone === "fact" && value.length <= 48 && !value.includes("\n")) {
            return (
              <div key={key} className={cx(MEASURE, "flex items-baseline justify-between gap-3")}>
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="text-caption font-semibold text-muted shrink-0">{label}</span>
                  <span className="font-mono text-caption text-fg truncate">{value}</span>
                </div>
                {edit}
              </div>
            );
          }

          return (
            <div
              key={key}
              className={cx(
                MEASURE,
                tone === "warn" && "border-l-2 border-medium pl-3",
                tone === "mine" && "rounded-md border border-accent-line bg-accent-soft p-3"
              )}
            >
              <Heading label={label} action={edit} />
              <p className="text-body leading-relaxed whitespace-pre-wrap m-0">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
