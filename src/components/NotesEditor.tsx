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

const FIELD_CLASS =
  "w-full min-h-[36px] font-[inherit] text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base";

export function NotesEditor({ problemId }: { problemId: string }) {
  const { v2Store, dispatchV2 } = useStore();
  const progress = getV2Progress(v2Store, problemId);

  return (
    <div>
      {progress.notes.legacy.trim() && (
        <div className="mb-2">
          <div className="text-[0.7rem] font-semibold text-muted mb-0.5">Previous notes</div>
          <div className="text-[0.8rem] whitespace-pre-wrap border border-border rounded-md p-1.5 bg-row-hover">
            {progress.notes.legacy}
          </div>
        </div>
      )}
      {FIELDS.map(({ key, label }) => (
        <div className="mb-2" key={key}>
          <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">{label}</label>
          <textarea
            defaultValue={progress.notes[key]}
            className={FIELD_CLASS}
            onBlur={(e) => dispatchV2({ type: "SET_STRUCTURED_NOTE", id: problemId, field: key, value: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
