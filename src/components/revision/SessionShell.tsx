import { useEffect, useRef, useState } from "react";
import questionsData from "../../../data/questions.json";
import { useStore } from "../../context";
import { createRevisionAttempt, mostRecentAttemptForTopic } from "../../revision/session";
import { getTopicRevision } from "../../store";
import { cx } from "../../cx";
import { ConfidenceStep } from "./ConfidenceStep";
import { FundamentalsStep } from "./FundamentalsStep";
import { RecallStep } from "./RecallStep";
import { ResultsStep } from "./ResultsStep";
import type { QuestionData, RevisionAttempt, Topic } from "../../types";

const QUESTIONS = questionsData as QuestionData;

type Step = "fundamentals" | "recall" | "confidence";

const STEPS: { id: Step; label: string }[] = [
  { id: "fundamentals", label: "Fundamentals" },
  { id: "recall", label: "Question recall" },
  { id: "confidence", label: "Confidence" },
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
    return <div className="mx-auto w-full max-w-reading px-5 pt-16 text-center text-muted text-body">Starting session…</div>;
  }

  if (attempt.submittedAt) {
    return <ResultsStep topic={topic} attempt={attempt} onExit={onExit} onOpenSettings={onOpenSettings} />;
  }

  const currentStep = step ?? defaultStep(attempt);

  return (
    <div className="mx-auto w-full max-w-reading px-4 md:px-6 pt-6 pb-16">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-title font-semibold tracking-tight m-0">Revision — {topic.name}</h1>
        <button type="button" onClick={onExit} className="btn-link text-ui">
          Exit
        </button>
      </div>
      <ol className="flex items-center gap-2 mt-3 mb-1.5" aria-label="Session progress">
        {STEPS.map((s, i) => {
          const active = s.id === currentStep;
          const done = STEPS.findIndex((x) => x.id === currentStep) > i;
          return (
            <li key={s.id} className="flex-1 min-w-0" aria-current={active ? "step" : undefined}>
              <div
                className={cx(
                  "h-1 rounded-full transition-colors",
                  done ? "bg-accent" : active ? "bg-accent" : "bg-border"
                )}
              />
              <span className={cx("block mt-1.5 text-micro truncate", active ? "text-fg font-semibold" : "text-muted")}>
                {i + 1}. {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-micro text-muted mb-5 mt-2">Saved automatically — safe to exit and resume anytime.</p>
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
