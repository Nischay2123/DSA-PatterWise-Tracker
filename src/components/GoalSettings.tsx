import questionsData from "../../data/questions.json";
import { useStore } from "../context";
import { cx } from "../cx";
import {
  ALL_DIFFICULTIES,
  GOAL_MIN_TOPIC_PROBLEMS,
  GOAL_PRESETS,
  getCuratedList,
  goalPresetId,
  resolveGoal,
  summarizeGoal,
} from "../revision/goal";
import type { Difficulty, FreqFloor, Goal } from "../revision/goal";
import { Icon } from "./Icon";
import type { QuestionData } from "../types";

const TOPICS = (questionsData as QuestionData).topics;

const FREQ_FLOOR_LABELS: { value: FreqFloor; label: string }[] = [
  { value: "All", label: "Any frequency" },
  { value: "Medium", label: "Medium and above" },
  { value: "High", label: "High and above" },
  { value: "Very High", label: "Very High only" },
];

// Shown under every option so the cost of a choice is visible before making
// it -- "143 problems, drops 5 topics" is the whole decision.
function ScopeLine({ goal }: { goal: Goal }) {
  const { store } = useStore();
  // `done` comes from the same walk as `problems`, so the two can never
  // describe different sets.
  const scope = summarizeGoal(TOPICS, goal, store);
  const list = getCuratedList(goal.listId);

  return (
    <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {list && (
        <span
          className="pill bg-sunken text-muted tabular-nums"
          title={`Not in this sheet: ${list.absent.join(", ")}`}
        >
          {list.ids.length} of {list.total} in this sheet
        </span>
      )}
      <span className="pill bg-accent-soft text-accent tabular-nums">
        {scope.done}/{scope.problems} revisable
      </span>
      <span className="pill bg-sunken text-muted tabular-nums">{scope.topicsInScope} topics revised</span>
      {scope.topicsDropped > 0 && (
        <span
          className="pill bg-medium-soft text-medium tabular-nums"
          title={`Fewer than ${GOAL_MIN_TOPIC_PROBLEMS} problems in scope, so revision skips them: ${scope.names.join(", ")}`}
        >
          <Icon name="alert" className="size-3" />
          {scope.topicsDropped} dropped
        </span>
      )}
    </span>
  );
}

export function GoalSettings() {
  const { v2Store, dispatchV2 } = useStore();
  const goal = resolveGoal(v2Store.settings);
  const activeId = goalPresetId(goal);
  // While a curated list is active the custom controls describe what you
  // would get by switching to them, not the list you are currently on.
  const customGoal: Goal = { minFreq: goal.minFreq, difficulties: goal.difficulties };

  const setGoal = (next: Goal) => dispatchV2({ type: "SET_SETTINGS", patch: { goal: next } });

  // Editing the frequency or difficulty means leaving any curated list
  // behind -- while listId is set those fields select nothing, so keeping it
  // would make the controls appear broken.
  const setCustom = ({ listId: _drop, ...next }: Goal) => setGoal(next);

  return (
    <div>
      <p className="text-micro text-muted mt-0 mb-3 leading-relaxed">
        Revision unlocks once a topic is 75% complete. A goal narrows what that 75% is measured against, so you start
        revising sooner. It never hides anything from the problem list.
      </p>

      <div role="radiogroup" aria-label="Revision goal" className="flex flex-col gap-2">
        {GOAL_PRESETS.map((preset) => {
          const active = activeId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setGoal(preset.goal)}
              className={cx(
                "w-full text-left rounded-lg border p-3 cursor-pointer transition-colors",
                active ? "border-accent bg-accent-soft" : "border-border bg-bg hover:border-border-strong"
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cx(
                    "grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
                    active ? "border-accent bg-accent text-accent-fg" : "border-border-strong"
                  )}
                >
                  {active && <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className="text-ui font-semibold">{preset.label}</span>
              </span>
              <span className="block text-micro text-muted mt-1 ml-6">{preset.description}</span>
              <span className="block ml-6">
                <ScopeLine goal={preset.goal} />
              </span>
            </button>
          );
        })}

        {/* Custom stays open because the preset frequency floors cover only
            three of the four rungs, and difficulty is a genuinely
            independent axis -- "Medium and above, nothing Hard yet" is a
            real re-onboarding goal no preset expresses. */}
        <div
          className={cx(
            "rounded-lg border p-3",
            activeId === "custom" ? "border-accent bg-accent-soft" : "border-border bg-bg"
          )}
        >
          <span className="flex items-center gap-2">
            <span
              className={cx(
                "grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
                activeId === "custom" ? "border-accent bg-accent text-accent-fg" : "border-border-strong"
              )}
              aria-hidden="true"
            >
              {activeId === "custom" && <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <span className="text-ui font-semibold">Custom</span>
          </span>

          <div className="ml-6 mt-2.5">
            <label className="field-label" htmlFor="goal-freq">
              Interview frequency
            </label>
            <select
              id="goal-freq"
              className="field"
              value={customGoal.minFreq}
              onChange={(e) => setCustom({ ...goal, minFreq: e.target.value as FreqFloor })}
            >
              {FREQ_FLOOR_LABELS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <span className="field-label mt-3">Difficulty</span>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Difficulty in scope">
              {ALL_DIFFICULTIES.map((d) => {
                const on = customGoal.difficulties.includes(d);
                // Never let the last one be unticked: an empty set would
                // scope every topic to nothing and silently kill revision.
                const isLast = on && customGoal.difficulties.length === 1;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    disabled={isLast}
                    title={isLast ? "At least one difficulty has to stay in scope" : undefined}
                    onClick={() =>
                      setCustom({
                        ...goal,
                        difficulties: (on
                          ? goal.difficulties.filter((x) => x !== d)
                          : [...goal.difficulties, d]) as Difficulty[],
                      })
                    }
                    className={cx("chip cursor-pointer py-1.5", on && "border-accent bg-accent-soft text-accent")}
                  >
                    {on && <Icon name="check" className="size-3" />}
                    {d}
                  </button>
                );
              })}
            </div>

            <ScopeLine goal={customGoal} />
          </div>
        </div>
      </div>
    </div>
  );
}
