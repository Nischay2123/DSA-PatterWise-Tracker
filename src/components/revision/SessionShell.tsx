import { useEffect, useRef, useState } from "react";
import questionsData from "../../../data/questions.json";
import { useStore } from "../../context";
import { createRevisionAttempt, mostRecentAttemptForTopic } from "../../revision/session";
import { getTopicRevision } from "../../store";
import { ConfidenceStep } from "./ConfidenceStep";
import { FundamentalsStep } from "./FundamentalsStep";
import { RecallStep } from "./RecallStep";
import { ResultsStep } from "./ResultsStep";
import type { QuestionData, RevisionAttempt, Topic } from "../../types";

const QUESTIONS = questionsData as QuestionData;

type Step = "fundamentals" | "recall" | "confidence";

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
    return <div className="max-w-[640px] mx-auto mt-10 px-5 text-center text-muted text-[0.85rem]">Starting session…</div>;
  }

  if (attempt.submittedAt) {
    return <ResultsStep topic={topic} attempt={attempt} onExit={onExit} onOpenSettings={onOpenSettings} />;
  }

  const currentStep = step ?? defaultStep(attempt);

  return (
    <div className="max-w-[640px] mx-auto mt-6 px-5 pb-16">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[1.1rem] font-semibold m-0">Revision — {topic.name}</h1>
        <button type="button" onClick={onExit} className="text-[0.8rem] text-muted bg-transparent border-0 cursor-pointer underline">
          Exit
        </button>
      </div>
      <div className="text-[0.75rem] text-muted mb-4">
        {currentStep === "fundamentals" && "Step 1 of 3 — Fundamentals"}
        {currentStep === "recall" && "Step 2 of 3 — Question recall"}
        {currentStep === "confidence" && "Step 3 of 3 — Confidence"}
        {" · saved automatically, safe to exit and resume anytime"}
      </div>
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
