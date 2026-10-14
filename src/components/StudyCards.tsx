import { cx } from "../cx";
import type { NotebookEntry } from "../notebook";
import { cheatRowOf, compactOf, patternConcepts, patternTraps, trickOf } from "../sweepDeck";
import type { Problem, QuestionProgressV2 } from "../types";
import { Icon } from "./Icon";
import { DIFFICULTY_PILL } from "./QuestionRow";

// The short views of what you wrote, shared by the weekly sweep and the
// notebook: the trick, the compact card, a pattern's cheat sheet and its card.

export function DifficultyPill({ problem }: { problem: Problem }) {
  return (
    <span
      className={cx("pill leading-none px-1.5 shrink-0 font-bold tracking-wide", DIFFICULTY_PILL[problem.difficulty])}
      title={problem.difficulty}
    >
      {problem.difficulty[0]}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 items-baseline">
      <span className="text-micro font-bold uppercase tracking-wide text-faint">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const prose = "text-body leading-relaxed whitespace-pre-wrap break-words m-0";

export function TrickView({ progress }: { progress: QuestionProgressV2 }) {
  const t = trickOf(progress);
  return (
    <div className="flex flex-col gap-3">
      {t.insight && <p className={cx(prose, "text-[1.05rem]")}>{t.insight}</p>}
      {t.reminder && (
        <p className={cx(prose, "rounded-md border border-accent-line bg-accent-soft p-3")}>{t.reminder}</p>
      )}
    </div>
  );
}

// `omit` is text already on screen (the sweep's trick), so it isn't shown twice.
export function CompactView({ progress, omit = "" }: { progress: QuestionProgressV2; omit?: string }) {
  const c = compactOf(progress);
  if (omit) {
    if (c.insight === omit) c.insight = "";
    if (c.approach === omit) c.approach = "";
  }
  return (
    <div className="flex flex-col gap-2.5">
      {c.insight && (
        <Row label="Insight">
          <p className={prose}>{c.insight}</p>
        </Row>
      )}
      {c.approach && (
        <Row label="Approach">
          <p className={prose}>{c.approach}</p>
        </Row>
      )}
      {c.traps.length > 0 && (
        <Row label="Trap">
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {c.traps.map((t) => (
              <li key={t} className={cx(prose, "border-l-2 border-medium pl-2.5")}>
                {t}
              </li>
            ))}
          </ul>
        </Row>
      )}
      {c.cost && (
        <Row label="Cost">
          <span className="font-mono text-caption">{c.cost}</span>
        </Row>
      )}
      {c.pseudocode && (
        <Row label="Pseudo">
          <pre className="card-inset p-2.5 m-0 font-mono text-caption leading-relaxed overflow-x-auto whitespace-pre">
            {c.pseudocode}
          </pre>
        </Row>
      )}
    </div>
  );
}

// One row per solved problem: scan a whole pattern in a minute. Stacks into
// labelled blocks on a phone, where four columns can't fit.
export function CheatSheet({ entries }: { entries: NotebookEntry[] }) {
  const rows = entries.filter((e) => e.written);
  if (!rows.length) return <p className="text-caption text-faint m-0 py-2">Nothing written for these yet.</p>;
  const cols = "md:grid md:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)_minmax(0,2fr)_7.5rem] md:gap-4";
  return (
    <div className="text-ui">
      <div className={cx(cols, "max-md:hidden text-micro font-bold uppercase tracking-wide text-faint pb-1.5 border-b border-border")}>
        <span>Problem</span>
        <span>Trick</span>
        <span>Trap</span>
        <span>Cost</span>
      </div>
      {rows.map(({ problem, progress }) => {
        const r = cheatRowOf(progress);
        return (
          <div key={problem.id} className={cx(cols, "py-2.5 border-b border-border last:border-b-0 max-md:flex max-md:flex-col max-md:gap-1")}>
            <span className="flex items-start gap-1.5 font-semibold min-w-0">
              <DifficultyPill problem={problem} />
              <span className="min-w-0">{problem.question}</span>
            </span>
            <span className="leading-relaxed min-w-0">{r.trick || <span className="text-faint">—</span>}</span>
            <span className="leading-relaxed text-muted min-w-0">
              {r.trap ? (
                <>
                  <span className="md:hidden font-semibold text-medium">Trap: </span>
                  {r.trap}
                </>
              ) : (
                <span className="text-faint max-md:hidden">—</span>
              )}
            </span>
            <span className="font-mono text-caption text-muted">{r.cost}</span>
          </div>
        );
      })}
    </div>
  );
}

// Read once before a pattern's flashcards: when it applies, and the traps you
// have already fallen into.
export function PatternCard({ patternId, entries }: { patternId: string; entries: NotebookEntry[] }) {
  const concepts = patternConcepts(patternId);
  const traps = patternTraps(entries);
  return (
    <div className="flex flex-col gap-5">
      {concepts.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-ui font-bold m-0 mb-2">
            <Icon name="brain" className="size-3.5 text-faint" />
            When and why it works
          </h3>
          <div className="flex flex-col gap-3">
            {concepts.map((c) => (
              <div key={c.id}>
                <div className="text-caption font-semibold text-muted mb-1">{c.prompt}</div>
                <ul className="m-0 pl-4 flex flex-col gap-0.5 text-body leading-relaxed">
                  {c.expectedConcepts.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {traps.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-ui font-bold m-0 mb-2">
            <Icon name="alert" className="size-3.5 text-faint" />
            Your traps in this pattern
          </h3>
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {traps.map((t) => (
              <li key={t.text} className="border-l-2 border-medium pl-3">
                <div className="text-body leading-relaxed">{t.text}</div>
                <div className="text-micro text-faint">{t.problem}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
