import { cx } from "../cx";
import { Icon, type IconName } from "./Icon";

// One tile, used by both the activity card and the revision dashboard --
// they were the same markup copy-pasted into two files under two names.
//
// The value uses PROPORTIONAL figures on purpose: tabular-nums gives every
// digit the width of a zero, which makes a standalone display number look
// loose. Tabular is for columns that must align, not for headline values.
export function StatTile({
  value,
  label,
  icon,
  tone = "neutral",
}: {
  value: number;
  label: string;
  icon?: IconName;
  tone?: "neutral" | "accent" | "star" | "hard";
}) {
  const toneClass = {
    neutral: "bg-sunken text-muted",
    accent: "bg-accent-soft text-accent",
    star: "bg-star-soft text-star",
    hard: "bg-hard-soft text-hard",
  }[tone];

  return (
    <div className="card p-3 flex items-center gap-2.5 min-w-0">
      {icon && (
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", toneClass)}>
          <Icon name={icon} className="size-4" />
        </span>
      )}
      <div className="min-w-0">
        <span className="block font-display text-title font-bold leading-none tracking-tight">{value}</span>
        <span className="block text-micro text-muted mt-1 truncate">{label}</span>
      </div>
    </div>
  );
}
