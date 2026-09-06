import { useEffect, useRef, useState } from "react";
import questionsData from "../../../data/questions.json";
import { useStore } from "../../context";
import { createRevisionAttempt, mostRecentAttemptForTopic } from "../../revision/session";
import { getTopicRevision } from "../../store";
import { cx } from "../../cx";
import { Icon, type IconName } from "../Icon";
import { ConfidenceStep } from "./ConfidenceStep";
import { FundamentalsStep } from "./FundamentalsStep";
import { RecallStep } from "./RecallStep";
import { ResultsStep } from "./ResultsStep";
import type { QuestionData, RevisionAttempt, Topic } from "../../types";

const QUESTIONS = questionsData as QuestionData;

type Step = "fundamentals" | "recall" | "confidence";

const STEPS: { id: Step; label: string; icon: IconName }[] = [
  { id: "fundamentals", label: "Fundamentals", icon: "brain" },
  { id: "recall", label: "Question recall", icon: "target" },
  { id: "confidence", label: "Confidence", icon: "sparkle" },
];

// Resumability (plan §6/§12: "refresh mid-session resumes exactly") is
// derived from what's already answered in the persisted attempt, not from a
// separately-stored "current step" field -- same "derive, don't store"
// principle the state machine already uses for revision state itself.
function defaultStep(attempt: RevisionAttempt): Step {
  const fundamentalsDone = attempt.fundamentals.every((f) => f.answer.trim().length > 0);
  if (!fundamentalsDone) return "fundamentals";
  const recallDone = attempt.questions.every((q) => q.approach.trim() && q.pseudocode.trim() && q.complexity.trim());
  if (!recallDone) return "recall";
  return "confidence";
}

// Shared by the session steps and the results screen so the two read as one
// flow instead of two pages that happen to share a URL.
export function SessionHeader({
  topic,
  onExit,
  exitLabel,
}: {
  topic: Topic;
  onExit: () => void;
  exitLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg shadow-panel">
        <Icon name="repeat" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="field-label mb-0.5">Revision session</div>
        <h1 className="font-display text-title font-bold tracking-tight m-0 truncate">{topic.name}</h1>
      </div>
      <button type="button" onClick={onExit} className="btn shrink-0">
        <Icon name="x" className="size-4" />
        <span className="max-sm:hidden">{exitLabel}</span>
      </button>
    </div>
  );
}

export function SessionShell({
  topic,
  onExit,
  onOpenSettings,
}: {
  topic: Topic;
  onExit: () => void;
  onOpenSettings: () => void;
}) {
  const { v2Store, dispatchV2 } = useStore();
  const topicRevision = getTopicRevision(v2Store, topic.id);
  // An in-progress draft (activeSessionId set) always wins; otherwise fall
  // back to the most recent attempt for this topic -- which, right after a
  // submit, IS that just-submitted (now PENDING) attempt. Only when there's
  // truly no attempt at all for this topic yet does a new one get created.
  const attempt = topicRevision.activeSessionId
    ? (v2Store.attempts[topicRevision.activeSessionId] ?? null)
    : mostRecentAttemptForTopic(v2Store, topic.id);
  const [step, setStep] = useState<Step | null>(null);
  // StrictMode (main.tsx) double-invokes this effect on mount with no
  // intervening render -- without this guard, both invocations see
  // `attempt` as still null and each dispatch their own brand-new attempt,
  // leaving one silently orphaned in v2.attempts forever (same class of bug
  // persistence/db.ts's `inFlight` guard already exists to prevent for the
  // initial boot load).
  const startedForTopicRef = useRef<string | null>(null);

  useEffect(() => {
    if (attempt || startedForTopicRef.current === topic.id) return;
    startedForTopicRef.current = topic.id;
    // Selection happens exactly once, here -- see createRevisionAttempt's
    // own comment on why re-running it on every render would break resume.
    const fresh = createRevisionAttempt(crypto.randomUUID(), topic.id, v2Store, QUESTIONS);
    dispatchV2({ type: "START_REVISION_SESSION", topicId: topic.id, attempt: fresh });
  }, [attempt, topic.id, v2Store, dispatchV2]);

  if (!attempt) {
    return (
      <div className="mx-auto grid w-full max-w-reading place-items-center px-5 pt-24 text-center">
        <Icon name="repeat" className="size-8 text-accent motion-safe:animate-spin [animation-duration:2s]" />
        <p className="text-body text-muted mt-3">Starting session…</p>
      </div>
    );
  }

  if (attempt.submittedAt) {
    return <ResultsStep topic={topic} attempt={attempt} onExit={onExit} onOpenSettings={onOpenSettings} />;
  }

  const currentStep = step ?? defaultStep(attempt);
  const currentIndex = STEPS.findIndex((x) => x.id === currentStep);

  return (
    <div className="mx-auto w-full max-w-reading px-4 md:px-6 pt-6 pb-20">
      <SessionHeader topic={topic} onExit={onExit} exitLabel="Exit" />

      {/* Was the plain text "Step 1 of 3". Now each step is a real target
          with its own icon, and the connector fills as you advance. */}
      <ol className="flex items-center gap-1 mb-2" aria-label="Session progress">
        {STEPS.map((s, i) => {
          const active = i === currentIndex;
          const done = i < currentIndex;
          return (
            <li key={s.id} className="flex-1 min-w-0 flex items-center gap-1" aria-current={active ? "step" : undefined}>
              <div
                className={cx(
                  "flex items-center gap-2 min-w-0 rounded-full border px-2.5 py-1.5 transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : done
                      ? "border-transparent bg-transparent text-fg"
                      : "border-transparent bg-transparent text-faint"
                )}
              >
                <span
                  className={cx(
                    "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                    active ? "bg-accent text-accent-fg" : done ? "bg-accent/25 text-accent" : "bg-sunken text-faint"
                  )}
                >
                  {done ? <Icon name="check" className="size-3" /> : i + 1}
                </span>
                <span className="text-micro font-semibold truncate max-sm:hidden">{s.label}</span>
                <Icon name={s.icon} className="size-3.5 shrink-0 sm:hidden" />
              </div>
              {i < STEPS.length - 1 && (
                <span className={cx("h-px flex-1 min-w-2", done ? "bg-accent/40" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-micro text-faint mb-6 flex items-center gap-1.5">
        <Icon name="check" className="size-3.5 shrink-0" />
        Saved automatically — safe to exit and resume anytime.
      </p>

      {currentStep === "fundamentals" && <FundamentalsStep attempt={attempt} onNext={() => setStep("recall")} />}
      {currentStep === "recall" && (
        <RecallStep attempt={attempt} topic={topic} onBack={() => setStep("fundamentals")} onNext={() => setStep("confidence")} />
      )}
      {currentStep === "confidence" && (
        <ConfidenceStep attempt={attempt} topic={topic} onBack={() => setStep("recall")} />
      )}
    </div>
  );
}
