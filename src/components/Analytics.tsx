import { useStore } from "../context";
import { breakdownBy, getState } from "../store";
import type { Problem } from "../types";
import { ProgressBar } from "./ProgressBar";

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];
const IMPORTANCE_ORDER = ["High", "Medium", "Low"];
const FREQ_ORDER = ["Very High", "High", "Medium", "Low"];

export function Analytics({ allProblems }: { allProblems: Problem[] }) {
  const { store } = useStore();
  const revised = allProblems.filter((p) => getState(store, p.id).revise).length;

  const sections = [
    { title: "Difficulty", rows: breakdownBy(allProblems, (p) => p.difficulty, DIFFICULTY_ORDER, store) },
    { title: "Importance", rows: breakdownBy(allProblems, (p) => p.importance, IMPORTANCE_ORDER, store) },
    { title: "Interview Frequency", rows: breakdownBy(allProblems, (p) => p.interviewFreq, FREQ_ORDER, store) },
  ];

  return (
    <details className="group/analytics border-t border-border mt-4">
      <summary
        className="text-body font-semibold pt-2.5 cursor-pointer list-none
          [&::-webkit-details-marker]:hidden before:content-['▸'] before:mr-1.5 group-open:before:content-['▾']"
      >
        Analytics
      </summary>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3 pt-3 pb-0.5">
        {sections.map((sec) => (
          <div className="card-soft py-3 px-3.5" key={sec.title}>
            <div className="text-ui font-semibold mb-2.5">{sec.title}</div>
            {sec.rows.map((r) => (
              <div className="flex items-center gap-2.5 my-1.5 text-caption" key={r.label}>
                <span className="w-20 shrink-0 text-muted">{r.label}</span>
                <ProgressBar done={r.done} total={r.total} mini />
                <span className="w-12 shrink-0 text-right text-muted tabular-nums">{`${r.done}/${r.total}`}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="card-soft py-3 px-3.5">
          <div className="text-ui font-semibold mb-2.5">Marked for revision</div>
          <div className="flex items-center gap-2.5 my-1.5 text-caption">
            <span className="w-20 shrink-0 text-muted">★ Revision</span>
            <span className="text-muted">{revised}</span>
          </div>
        </div>
      </div>
    </details>
  );
}
