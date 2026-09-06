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
    <details className="group border-t border-border mt-3">
      <summary
        className="text-[0.85rem] font-semibold pt-2.5 cursor-pointer list-none
          [&::-webkit-details-marker]:hidden before:content-['▸'] before:mr-1.5 group-open:before:content-['▾']"
      >
        Analytics
      </summary>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 pt-2.5 pb-0.5">
        {sections.map((sec) => (
          <div className="border border-border rounded-lg py-2.5 px-3" key={sec.title}>
            <div className="text-[0.8rem] font-semibold mb-2">{sec.title}</div>
            {sec.rows.map((r) => (
              <div className="flex items-center gap-2 my-1.5 text-[0.78rem]" key={r.label}>
                <span className="w-[70px] shrink-0 text-muted">{r.label}</span>
                <ProgressBar done={r.done} total={r.total} mini />
                <span className="w-12 shrink-0 text-right text-muted">{`${r.done}/${r.total}`}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="border border-border rounded-lg py-2.5 px-3">
          <div className="text-[0.8rem] font-semibold mb-2">Marked for revision</div>
          <div className="flex items-center gap-2 my-1.5 text-[0.78rem]">
            <span className="w-[70px] shrink-0 text-muted">★ Revision</span>
            <span className="text-muted">{revised}</span>
          </div>
        </div>
      </div>
    </details>
  );
}
