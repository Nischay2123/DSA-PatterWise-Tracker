import { useEffect, useState } from "react";
import questionsData from "../../data/questions.json";
import { useStore } from "../context";
import { cx } from "../cx";
import { buildNotebook } from "../notebook";
import { goalPresetId, GOAL_PRESETS, isFullGoal, resolveGoal } from "../revision/goal";
import { SWEEP_INTERVAL_DAYS } from "../revision/sweepSchedule";
import { todayISO } from "../store";
import { buildDeck, estimateMinutes, trickOf, type DeckCard, type DeckPattern } from "../sweepDeck";
import type { AppStoreV2, QuestionData, SweepRating } from "../types";
import { Icon } from "./Icon";
import { FullEntry } from "./NotebookPage";
import { CompactView, DifficultyPill, PatternCard, TrickView } from "./StudyCards";

const DATA = questionsData as QuestionData;

// The weekly sweep: one fast pass over everything you've solved. Per pattern,
// a short card on when it applies and the traps you've hit, then a flashcard
// per problem -- recall first, then check, then say how it went. Separate from
// topic revision: nothing here is graded, and it never blocks anything.

type Step = { kind: "pattern"; pattern: DeckPattern } | { kind: "card"; card: DeckCard; pattern: DeckPattern };

const RATINGS: { id: SweepRating; label: string; key: string; className: string }[] = [
  { id: "blank", label: "Blank", key: "1", className: "bg-hard-soft text-hard border-hard/30" },
  { id: "fuzzy", label: "Fuzzy", key: "2", className: "bg-medium-soft text-medium border-medium/30" },
  { id: "knew", label: "Knew it", key: "3", className: "bg-easy-soft text-easy border-easy/30" },
];
const LAST: Record<SweepRating, string> = { blank: "blank", fuzzy: "fuzzy", knew: "knew it" };

export function sweepDeckFor(v2Store: AppStoreV2) {
  return buildDeck(buildNotebook(DATA.topics, v2Store, resolveGoal(v2Store.settings)), todayISO());
}

function stepsFor(patterns: DeckPattern[]): Step[] {
  return patterns
    .filter((p) => p.due.length)
    .flatMap((pattern) => [
      { kind: "pattern" as const, pattern },
      ...pattern.due.map((card) => ({ kind: "card" as const, card, pattern })),
    ]);
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="max-sm:hidden ml-1.5 rounded border border-border bg-bg px-1 font-mono text-micro text-faint">{children}</kbd>
  );
}

function Session({ steps, onExit }: { steps: Step[]; onExit: () => void }) {
  const { dispatchV2 } = useStore();
  const [i, setI] = useState(0);
  // 0 = front, 1 = the trick, 2 = + compact card, 3 = + full notes
  const [depth, setDepth] = useState(0);
  const [results, setResults] = useState<{ card: DeckCard; rating: SweepRating }[]>([]);
  const step = steps[i] as Step | undefined;
  const cardsTotal = steps.filter((s) => s.kind === "card").length;

  const next = () => {
    setI((n) => n + 1);
    setDepth(0);
    window.scrollTo(0, 0);
  };
  const rate = (rating: SweepRating) => {
    if (step?.kind !== "card" || depth === 0) return;
    dispatchV2({ type: "RATE_SWEEP", id: step.card.entry.problem.id, rating, at: todayISO() });
    setResults((r) => [...r, { card: step.card, rating }]);
    next();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && !!e.target.closest("input, textarea, select");
      if (e.metaKey || e.ctrlKey || e.altKey || typing) return;
      if (e.key === "Escape") return onExit();
      if (!step) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (step.kind === "pattern") next();
        else if (depth === 0) setDepth(1);
        return;
      }
      if (step.kind !== "card" || depth === 0) return;
      const r = RATINGS.find((x) => x.key === e.key);
      if (r) rate(r.id);
      else if (e.key.toLowerCase() === "m") setDepth((d) => Math.max(d, 2));
      else if (e.key.toLowerCase() === "f") setDepth(3);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!step) {
    const count = (r: SweepRating) => results.filter((x) => x.rating === r).length;
    const weak = results.filter((x) => x.rating !== "knew");
    return (
      <div className="card px-5 py-6 md:px-8 max-w-2xl mx-auto">
        <h1 className="font-display text-title font-bold m-0 mb-1">Sweep done</h1>
        <p className="text-body text-muted m-0 mb-5">
          {results.length} card{results.length === 1 ? "" : "s"} recalled. Knew-it cards come back less and less often;
          the rest come back next week.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {RATINGS.map((r) => (
            <div key={r.id} className={cx("rounded-lg border p-3 text-center", r.className)}>
              <div className="font-display text-title font-bold tabular-nums">{count(r.id)}</div>
              <div className="text-caption font-semibold">{r.label}</div>
            </div>
          ))}
        </div>
        {weak.length > 0 && (
          <>
            <h2 className="text-ui font-bold m-0 mb-2">Worth a re-solve</h2>
            <ul className="m-0 mb-5 p-0 list-none flex flex-col gap-1">
              {weak.map(({ card, rating }) => (
                <li key={card.entry.problem.id} className="flex items-center gap-2 text-body">
                  <DifficultyPill problem={card.entry.problem} />
                  <span className="min-w-0">{card.entry.problem.question}</span>
                  <span className="ml-auto text-micro text-faint shrink-0">
                    {card.patternName} · {LAST[rating]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="btn btn-primary" onClick={onExit}>
          Back to the sweep
        </button>
      </div>
    );
  }

  const cardNo = steps.slice(0, i + 1).filter((s) => s.kind === "card").length;
  const p = step.pattern;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <button type="button" className="btn btn-quiet btn-sm" onClick={onExit} title="Stop here (Esc). Ratings so far are saved.">
          <Icon name="x" className="size-3.5" />
          Stop
        </button>
        <span className="text-caption text-muted min-w-0 truncate">
          {p.topicName} › {p.name}
        </span>
        <span className="ml-auto text-caption text-muted tabular-nums shrink-0">
          {cardNo}/{cardsTotal}
        </span>
      </div>
      <div className="h-1 rounded-full bg-border mb-4 overflow-hidden" role="presentation">
        <div className="h-full bg-progress transition-[width] duration-300" style={{ width: `${(i / steps.length) * 100}%` }} />
      </div>

      {step.kind === "pattern" ? (
        <div className="card px-5 py-6 md:px-8">
          <div className="text-micro font-bold uppercase tracking-wide text-accent mb-1">Pattern</div>
          <h1 className="font-display text-title font-bold m-0">{p.name}</h1>
          <p className="text-caption text-muted m-0 mt-1 mb-5">
            {p.due.length} card{p.due.length === 1 ? "" : "s"} to recall · read this once, then go.
          </p>
          <PatternCard patternId={p.id} entries={p.cards.map((c) => c.entry)} />
          <button type="button" className="btn btn-primary mt-6" onClick={next} autoFocus>
            Start cards
            <Kbd>Space</Kbd>
          </button>
        </div>
      ) : (
        <div className="card px-5 py-6 md:px-8">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <DifficultyPill problem={step.card.entry.problem} />
            <h1 className="font-display text-title font-bold m-0 min-w-0">{step.card.entry.problem.question}</h1>
          </div>
          <p className="text-caption text-muted m-0 mb-5">
            {step.card.entry.progress.sweep ? `Last time: ${LAST[step.card.entry.progress.sweep.rating]}` : "First time in the sweep"}
          </p>

          {depth === 0 ? (
            <>
              <p className="text-body text-muted m-0 mb-5">
                Say the trick to yourself — why it works, the approach, the trap — then check.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setDepth(1)} autoFocus>
                Reveal
                <Kbd>Space</Kbd>
              </button>
            </>
          ) : (
            <>
              <TrickView progress={step.card.entry.progress} />

              {depth >= 2 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <CompactView progress={step.card.entry.progress} omit={trickOf(step.card.entry.progress).insight} />
                </div>
              )}
              {depth >= 3 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <FullEntry entry={step.card.entry} bare />
                </div>
              )}

              <div className="flex gap-1.5 mt-4">
                {depth < 2 && (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setDepth(2)}>
                    More
                    <Kbd>M</Kbd>
                  </button>
                )}
                {depth < 3 && (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setDepth(3)}>
                    Full notes
                    <Kbd>F</Kbd>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-border">
                {RATINGS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => rate(r.id)}
                    className={cx("btn justify-center border font-semibold", r.className)}
                  >
                    {r.label}
                    <Kbd>{r.key}</Kbd>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SweepPage({ scope, onNavigate }: { scope: string | undefined; onNavigate: (hash: string) => void }) {
  const { v2Store } = useStore();
  const deck = sweepDeckFor(v2Store);
  // The session is fixed when it starts, so a card doesn't vanish mid-session
  // the moment it's rated.
  const topicPatterns = (id: string) => (id === "all" ? deck.flatMap((t) => t.patterns) : deck.find((t) => t.id === id)?.patterns ?? []);
  const [session, setSession] = useState<{ scope: string; steps: Step[] } | null>(() =>
    scope ? { scope, steps: stepsFor(topicPatterns(scope)) } : null
  );
  useEffect(() => {
    if (scope && session?.scope !== scope) setSession({ scope, steps: stepsFor(topicPatterns(scope)) });
    if (!scope && session) setSession(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  if (scope && session) return <Session steps={session.steps} onExit={() => onNavigate("#/sweep")} />;

  const goal = resolveGoal(v2Store.settings);
  const sheet = isFullGoal(goal) ? "Full syllabus" : (GOAL_PRESETS.find((p) => p.id === goalPresetId(goal))?.label ?? "your goal");
  const all = deck.flatMap((t) => t.patterns);
  const due = deck.reduce((n, t) => n + t.due, 0);
  const cards = deck.reduce((n, t) => n + t.cards, 0);
  const unwritten = deck.reduce((n, t) => n + t.unwritten, 0);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-title font-bold m-0">Weekly sweep</h1>
      <p className="text-body text-muted m-0 mt-1 mb-5">
        One fast pass over everything you've solved in <b>{sheet}</b>. For each pattern: a short card on when it applies and
        your traps, then a flashcard per problem — recall first, then check.
      </p>

      <div className="card p-4 md:p-5 mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex gap-6">
          <div>
            <div className="font-display text-title font-bold tabular-nums leading-none">{due}</div>
            <div className="text-micro text-muted mt-1">cards due</div>
          </div>
          <div>
            <div className="font-display text-title font-bold tabular-nums leading-none">~{estimateMinutes(all)}</div>
            <div className="text-micro text-muted mt-1">minutes</div>
          </div>
          <div>
            <div className="font-display text-title font-bold tabular-nums leading-none">{cards}</div>
            <div className="text-micro text-muted mt-1">cards in all</div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary sm:ml-auto"
          disabled={!due}
          onClick={() => onNavigate("#/sweep/all")}
        >
          <Icon name="play" className="size-3.5" />
          {due ? "Start the sweep" : "All caught up"}
        </button>
      </div>

      {deck.length === 0 ? (
        <p className="text-body text-muted">
          Nothing to sweep yet. Solved problems with a key insight, reminder or approach written become cards here.
        </p>
      ) : (
        <div className="card divide-y divide-border">
          {deck.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-ui font-semibold truncate">{t.name}</div>
                <div className="text-micro text-muted tabular-nums">
                  {t.due ? `${t.due} due · ~${estimateMinutes(t.patterns)} min` : "nothing due"} · {t.cards} card
                  {t.cards === 1 ? "" : "s"}
                  {t.unwritten > 0 && ` · ${t.unwritten} without notes`}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm ml-auto shrink-0"
                disabled={!t.due}
                onClick={() => onNavigate(`#/sweep/${t.id}`)}
              >
                Start
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-caption text-muted mt-4 mb-0">
        <b>Knew it</b> two weeks running moves a card to every {SWEEP_INTERVAL_DAYS[2]} days, then every{" "}
        {SWEEP_INTERVAL_DAYS[3]}; <b>Fuzzy</b> or <b>Blank</b> brings it back next week. Ratings save as you go, so you can
        stop at any card.
        {unwritten > 0 &&
          ` ${unwritten} solved problem${unwritten === 1 ? " has" : "s have"} nothing written to recall from, so ${unwritten === 1 ? "it isn't" : "they aren't"} in the deck — add a key insight from the tracker.`}
      </p>
    </div>
  );
}
