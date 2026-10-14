import { useEffect, useRef } from "react";
import questionsData from "../../data/questions.json";
import { useStore } from "../context";
import { cx } from "../cx";
import { problemLink } from "../links";
import { buildNotebook, type NotebookEntry, type NotebookTopic } from "../notebook";
import { GOAL_PRESETS, goalPresetId, isFullGoal, resolveGoal } from "../revision/goal";
import type { QuestionData } from "../types";
import { Icon } from "./Icon";
import { FIELDS } from "./NotesEditor";
import { DIFFICULTY_PILL } from "./QuestionRow";

const DATA = questionsData as QuestionData;

// Everything you wrote for the problems you've solved, laid out like the sheet,
// to read straight through. Read-only: writing stays on the problem row.

function Block({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-caption font-semibold text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}

const prose = "text-body leading-relaxed whitespace-pre-wrap break-words m-0";
const mono = "card-inset p-3 m-0 font-mono text-caption leading-relaxed overflow-x-auto whitespace-pre";

function Entry({ entry }: { entry: NotebookEntry }) {
  const { problem, progress: p } = entry;
  const link = problemLink(problem);
  const notes = FIELDS.filter((f) => p.notes[f.key].trim());
  const hasSolution = !!(p.approach.trim() || p.pseudocode.trim() || p.code.trim());
  const hasNotesSide = notes.length > 0 || !!p.notes.legacy.trim() || p.mistakes.length > 0;

  return (
    <article className="py-5 border-t border-border first:border-t-0 first:pt-2" id={`nb-${problem.id}`}>
      <header className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className={cx("pill leading-none px-1.5 shrink-0 font-bold tracking-wide", DIFFICULTY_PILL[problem.difficulty])}
          title={problem.difficulty}
        >
          {problem.difficulty[0]}
        </span>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener"
            className="font-display text-head font-bold text-fg hover:text-accent decoration-accent/40 underline-offset-2 hover:underline"
          >
            {problem.question}
          </a>
        ) : (
          <span className="font-display text-head font-bold">{problem.question}</span>
        )}
        {p.lastCompletedAt && (
          <span className="ml-auto text-micro text-faint tabular-nums">Solved {p.lastCompletedAt}</span>
        )}
      </header>

      {!entry.written ? (
        <p className="text-caption text-faint m-0">Nothing written for this one yet — add notes from its row in the tracker.</p>
      ) : (
        <div className={cx("grid gap-6", hasSolution && hasNotesSide && "xl:grid-cols-2")}>
          {hasNotesSide && (
            <div className="flex flex-col gap-4 min-w-0">
              {notes.map(({ key, label, tone }) => (
                <Block
                  key={key}
                  label={label}
                  className={cx(
                    tone === "warn" && "border-l-2 border-medium pl-3",
                    tone === "mine" && "rounded-md border border-accent-line bg-accent-soft p-3"
                  )}
                >
                  <p className={cx(prose, tone === "fact" && "font-mono text-caption")}>{p.notes[key]}</p>
                </Block>
              ))}
              {p.notes.legacy.trim() && (
                <Block label="Previous notes">
                  <p className={cx(prose, "text-muted")}>{p.notes.legacy}</p>
                </Block>
              )}
              {p.mistakes.length > 0 && (
                <Block label={`Mistakes (${p.mistakes.length})`}>
                  <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                    {p.mistakes.map((m) => (
                      <li key={m.at} className="card-inset p-2.5 border-l-2 border-l-hard">
                        <div className="text-ui font-medium whitespace-pre-wrap break-words">{m.what}</div>
                        {m.remember && (
                          <div className="text-caption text-muted mt-1 flex items-start gap-1">
                            <Icon name="arrowRight" className="size-3 mt-0.5 shrink-0" />
                            <span className="whitespace-pre-wrap break-words min-w-0">{m.remember}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}
            </div>
          )}
          {hasSolution && (
            <div className="flex flex-col gap-4 min-w-0">
              {p.approach.trim() && (
                <Block label="My approach">
                  <p className={prose}>{p.approach}</p>
                </Block>
              )}
              {p.pseudocode.trim() && (
                <Block label="Pseudocode">
                  <pre className={mono}>{p.pseudocode}</pre>
                </Block>
              )}
              {p.code.trim() && (
                <Block label="Code">
                  <pre className={mono}>{p.code}</pre>
                </Block>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function TopicView({ topic }: { topic: NotebookTopic }) {
  const body = useRef<HTMLDivElement>(null);
  const setAll = (open: boolean) =>
    body.current?.querySelectorAll("details").forEach((d) => ((d as HTMLDetailsElement).open = open));

  return (
    <article className="card min-w-0 px-4 py-5 md:px-7">
      <header className="flex items-start gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <h1 className="font-display text-title font-bold m-0">{topic.name}</h1>
          <p className="text-caption text-muted m-0 mt-1 tabular-nums">
            {topic.solved} solved · {topic.written} with notes · {topic.patterns.length} pattern
            {topic.patterns.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="ml-auto flex gap-1.5">
          <button type="button" className="btn btn-sm" onClick={() => setAll(true)}>
            Open all
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAll(false)}>
            Close all
          </button>
        </span>
      </header>

      <div ref={body} className="flex flex-col gap-2">
        {topic.patterns.map((pattern) => (
          <details key={pattern.id} className="group/nb rounded-lg border border-border" open={topic.patterns.length === 1}>
            <summary className="disclosure flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-row-hover cursor-pointer">
              <Icon name="chevronRight" className="size-3.5 text-faint shrink-0 transition-transform group-open/nb:rotate-90" />
              <span className="text-ui font-semibold min-w-0 truncate">{pattern.name}</span>
              <span className="chip ml-auto shrink-0 tabular-nums py-0.5 px-1.5">
                {pattern.entries.filter((e) => e.written).length}/{pattern.entries.length} written
              </span>
            </summary>
            <div className="px-3 md:px-4 pb-2">
              {pattern.entries.map((e) => (
                <Entry key={e.problem.id} entry={e} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </article>
  );
}

export function NotebookPage({ topicId, onNavigate }: { topicId: string | undefined; onNavigate: (hash: string) => void }) {
  const { v2Store } = useStore();
  const goal = resolveGoal(v2Store.settings);
  const sheet = isFullGoal(goal) ? "Full syllabus" : (GOAL_PRESETS.find((p) => p.id === goalPresetId(goal))?.label ?? "your goal");
  const book = buildNotebook(DATA.topics, v2Store, goal);
  const topic = book.find((t) => t.id === topicId) ?? book[0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [topic?.id]);

  if (!topic) {
    return (
      <div className="card grid place-items-center gap-2 py-14 px-4 text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-sunken text-faint">
          <Icon name="pencil" className="size-5" />
        </span>
        <p className="text-body text-muted m-0">
          Nothing here yet. Problems you solve in {sheet} show up here with your notes, solution and mistakes.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-caption text-muted mt-0 mb-4">
        Your notes, solutions and mistakes for every problem you've solved in <b>{sheet}</b>, in sheet order. Read-only —
        edit them from the problem's row in the tracker.
      </p>
      <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] gap-6">
        <select
          className="field md:hidden mb-4"
          aria-label="Choose a topic"
          value={topic.id}
          onChange={(e) => onNavigate(`#/notebook/${e.target.value}`)}
        >
          {book.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.solved})
            </option>
          ))}
        </select>

        <nav className="max-md:hidden sticky top-5 self-start max-h-[calc(100vh-2.5rem)] overflow-y-auto pr-1">
          <div className="field-label px-2">Topics</div>
          {book.map((t) => (
            <a
              key={t.id}
              href={`#/notebook/${t.id}`}
              aria-current={t.id === topic.id ? "page" : undefined}
              className={cx(
                "flex items-center gap-2 rounded-md px-2 py-1 text-ui",
                t.id === topic.id ? "bg-accent-soft text-accent font-semibold" : "text-muted hover:text-fg hover:bg-row-hover"
              )}
            >
              <span className="min-w-0 truncate">{t.name}</span>
              <span className="ml-auto text-micro tabular-nums text-faint">{t.solved}</span>
            </a>
          ))}
        </nav>

        <TopicView key={topic.id} topic={topic} />
      </div>
    </>
  );
}
