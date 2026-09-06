import { cx } from "../cx";

interface ProgressBarProps {
  done: number;
  total: number;
  mini?: boolean;
}

export function ProgressBar({ done, total, mini }: ProgressBarProps) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cx("flex-1 bg-heat-1/60 rounded-full overflow-hidden", mini ? "h-1.5" : "h-2")}>
      <div className="h-full bg-progress transition-[width] duration-200" style={{ width: `${pct}%` }} />
    </div>
  );
}
