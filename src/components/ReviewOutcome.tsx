import { cx } from "../cx";
import type { ReviewOutcome } from "../types";

const OUTCOMES: { value: ReviewOutcome; label: string; title: string }[] = [
  { value: "clean", label: "Clean", title: "Solved it without help. A clean solve needs no reviews; a clean review moves to the next, longer interval" },
  { value: "hint", label: "Took a hint", title: "Needed a nudge: it comes back for review" },
  { value: "solution", label: "Saw the solution", title: "Looked at the answer: it comes back for review tomorrow" },
];

// How a solve or a review went. Drives the per-question review ladder in
// revision/questionReview.ts.
export function ReviewOutcomeButtons({
  value,
  onPick,
  label,
  only,
}: {
  value?: ReviewOutcome;
  onPick: (outcome: ReviewOutcome) => void;
  label: string;
  /** Limit the choices, e.g. to the outcomes that schedule a review. */
  only?: ReviewOutcome[];
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={label}>
      <span className="text-caption text-muted mr-0.5">{label}</span>
      {OUTCOMES.filter((o) => !only || only.includes(o.value)).map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === undefined ? undefined : value === o.value}
          onClick={() => onPick(o.value)}
          className={cx(
            "chip cursor-pointer py-0.5",
            value === o.value
              ? "border-accent bg-accent-soft text-accent"
              : o.value === "clean"
                ? "hover:border-easy hover:text-easy"
                : o.value === "hint"
                  ? "hover:border-medium hover:text-medium"
                  : "hover:border-hard hover:text-hard"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
