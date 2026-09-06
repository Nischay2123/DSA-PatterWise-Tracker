import { useStore } from "../context";
import { getV2Progress } from "../store";
import type { StructuredNoteField } from "../types";

const FIELDS: { key: StructuredNoteField; label: string }[] = [
  { key: "approach", label: "Approach" },
  { key: "keyInsight", label: "Key Insight" },
  { key: "commonMistake", label: "Common Mistake" },
  { key: "complexity", label: "Complexity" },
  { key: "edgeCases", label: "Edge Cases" },
  { key: "reminder", label: "Personal Reminder" },
];


export function NotesEditor({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);

  return (
    <div>
      {progress.notes.legacy.trim() && (
        <div className="mb-2">
          <div className="text-micro font-semibold text-muted mb-0.5">Previous notes</div>
          <div className="text-ui whitespace-pre-wrap card-soft p-2">
            {progress.notes.legacy}
          </div>
        </div>
      )}
      {FIELDS.map(({ key, label }) => (
        <div className="mb-2" key={key}>
          <label className="field-label">{label}</label>
          <textarea
            defaultValue={progress.notes[key]}
            className="field"
              rows={2}
            onBlur={(e) => dispatchV2({ type: "SET_STRUCTURED_NOTE", id: problemId, field: key, value: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
