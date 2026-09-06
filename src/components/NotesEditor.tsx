import { useStore } from "../context";
import { getV2Progress } from "../store";
import { Icon } from "./Icon";
import type { StructuredNoteField } from "../types";

const FIELDS: { key: StructuredNoteField; label: string }[] = [
  { key: "approach", label: "Approach" },
  { key: "keyInsight", label: "Key insight" },
  { key: "commonMistake", label: "Common mistake" },
  { key: "complexity", label: "Complexity" },
  { key: "edgeCases", label: "Edge cases" },
  { key: "reminder", label: "Personal reminder" },
];

export function NotesEditor({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="book" className="size-3.5 text-faint" />
        <span className="text-ui font-bold">Notes</span>
      </div>

      {progress.notes.legacy.trim() && (
        <div className="mb-3">
          <div className="field-label">Previous notes</div>
          <div className="card-inset p-2.5 text-ui whitespace-pre-wrap">{progress.notes.legacy}</div>
        </div>
      )}

      {/* Two columns on anything above a phone: six stacked single-line
          textareas made the panel scroll for no reason. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="field-label">{label}</label>
            <textarea
              defaultValue={progress.notes[key]}
              className="field resize-y"
              rows={2}
              onBlur={(e) =>
                dispatchV2({ type: "SET_STRUCTURED_NOTE", id: problemId, field: key, value: e.target.value })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
