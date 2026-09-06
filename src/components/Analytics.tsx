import { useStore } from "../context";
import { breakdownBy, getState } from "../store";
import type { Problem } from "../types";
import { Icon } from "./Icon";
import { ProgressBar } from "./ProgressBar";

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];
const IMPORTANCE_ORDER = ["High", "Medium", "Low"];
const FREQ_ORDER = ["Very High", "High", "Medium", "Low"];

export function Analytics({ allProblems }: { allProblems: Problem[] }) {
  const { store } = useStore();
  const revised = allProblems.filter((p) => getState(store, p.id).revise).length;

  const sections = [
    { title: "Difficulty", icon: "target", rows: breakdownBy(allProblems, (p) => p.difficulty, DIFFICULTY_ORDER, store) },
    { title: "Importance", icon: "flame", rows: breakdownBy(allProblems, (p) => p.importance, IMPORTANCE_ORDER, store) },
    { title: "Interview frequency", icon: "clock", rows: breakdownBy(allProblems, (p) => p.interviewFreq, FREQ_ORDER, store) },
  ] as const;

  return (
    <details className="group/analytics card mt-3 overflow-hidden">
      <summary className="disclosure flex items-center gap-2 py-3 px-4 hover:bg-row-hover">
        <Icon name="sparkle" className="size-4 text-accent shrink-0" />
        <span className="font-display text-head font-bold">Breakdown</span>
        <Icon
          name="chevronDown"
          className="size-4 text-faint ml-auto transition-transform group-open/analytics:rotate-180"
        />
      </summary>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3 p-4 pt-1 border-t border-border">
        {sections.map((sec) => (
          <div className="card-inset py-3 px-3.5" key={sec.title}>
            <div className="flex items-center gap-1.5 mb-3">
              <Icon name={sec.icon} className="size-3.5 text-faint" />
              <span className="text-ui font-semibold">{sec.title}</span>
            </div>
            {sec.rows.map((r) => (
              <div className="flex items-center gap-2.5 my-2 text-caption" key={r.label}>
                <span className="w-20 shrink-0 text-muted">{r.label}</span>
                <ProgressBar done={r.done} total={r.total} mini />
                <span className="w-12 shrink-0 text-right text-muted tabular-nums">{`${r.done}/${r.total}`}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="card-inset py-3 px-3.5">
          <div className="flex items-center gap-1.5 mb-3">
            <Icon name="star" className="size-3.5 text-star" filled />
            <span className="text-ui font-semibold">Starred for revision</span>
          </div>
          <div className="font-display text-display font-bold tabular-nums leading-none">{revised}</div>
          <div className="text-micro text-muted mt-1.5">problems flagged to come back to</div>
        </div>
      </div>
    </details>
  );
}
