import { useState } from "react";
import { useStore } from "../context";
import { getV2Progress, hasCompletionEvidence } from "../store";
import { cx } from "../cx";
import { ERROR_MESSAGE } from "../llm/client";
import { canGradeSolutions, type SolutionAttempt } from "../llm/gradeSolution";
import { generateNotes, NOTE_FIELDS, notesToApply } from "../llm/notes";
import { Icon } from "./Icon";
import type { LlmErrorCode } from "../llm/client";
import type { Problem, StructuredNoteField } from "../types";

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

export function NotesEditor({
  problem,
  topicName,
  patternName,
}: {
  problem: Problem;
  topicName: string;
  patternName: string;
}) {
  const problemId = problem.id;
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);
  const [editing, setEditing] = useState<StructuredNoteField | null>(null);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<LlmErrorCode | "NO_CHANGE" | null>(null);

  const save = (field: StructuredNoteField, value: string) => {
    dispatchV2({ type: "SET_STRUCTURED_NOTE", id: problemId, field, value });
    setEditing(null);
  };

  // CompletionPanel writes these automatically, but only on the one path
  // where a solution passes grading. A question that was ticked before
  // grading existed, ticked without an API key, or whose notes call failed
  // (notes never hold up a passed solution) ends up done with the six fields
  // empty and no way back to them. This is that way back.
  //
  // The saved solution is what the notes are written from, so the button
  // only exists once there is one -- there is nothing to ground notes in
  // otherwise. notesToApply still fills only empty fields, so anything
  // already written, by an earlier run or by hand, survives untouched.
  const canWrite = hasCompletionEvidence(progress);
  const missing = NOTE_FIELDS.filter((f) => !progress.notes[f].trim()).length;
  const keyed = canGradeSolutions(v2Store.settings);

  const writeNotes = async () => {
    if (writing || !canWrite || !keyed) return;
    setWriting(true);
    setError(null);
    const attempt: SolutionAttempt = {
      questionId: problemId,
      title: problem.question,
      patternName,
      difficulty: problem.difficulty,
      topicName,
      approach: progress.approach,
      pseudocode: progress.pseudocode,
      code: progress.code,
    };
    const result = await generateNotes(v2Store.settings, attempt);
    setWriting(false);
    if (!result.ok) return setError(result.error);
    const toApply = notesToApply(progress.notes, result.data);
    // Every field already had something in it, so nothing was written --
    // silence here reads as a broken button.
    if (toApply.length === 0) return setError("NO_CHANGE");
    for (const { field, value } of toApply) {
      dispatchV2({ type: "SET_STRUCTURED_NOTE", id: problemId, field, value });
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon name="book" className="size-3.5 text-faint" />
        <span className="text-ui font-bold">Notes</span>
        {/* Hidden once every field is filled: notesToApply would write
            nothing, so the button would only ever report doing nothing. */}
        {canWrite && missing > 0 && (
          <button
            type="button"
            onClick={writeNotes}
            disabled={writing || !keyed}
            title={
              keyed
                ? "Write the empty fields from your saved solution"
                : "Add an API key in Settings to write notes"
            }
            className="btn btn-quiet btn-sm ml-auto"
          >
            <Icon name={writing ? "clock" : "sparkle"} className="size-3.5" />
            {writing ? "Writing…" : missing === NOTE_FIELDS.length ? "Write these for me" : "Fill the empty ones"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-caption text-muted mt-0 mb-3">
          {error === "NO_CHANGE"
            ? "Every field already has something in it — nothing was overwritten."
            : ERROR_MESSAGE[error]}
        </p>
      )}

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
