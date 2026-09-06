import { cx } from "../cx";

interface ProgressBarProps {
  done: number;
  total: number;
  mini?: boolean;
}

export function ProgressBar({ done, total, mini }: ProgressBarProps) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cx("flex-1 bg-row-hover rounded-md overflow-hidden", mini ? "h-1.5" : "h-2.5")}>
      <div className="h-full bg-easy transition-[width] duration-200" style={{ width: `${pct}%` }} />
    </div>
  );
}
