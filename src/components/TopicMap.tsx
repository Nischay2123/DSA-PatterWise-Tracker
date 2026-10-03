import { useEffect, useRef, useState } from "react";
import { useStore } from "../context";
import { goalScoped, isExemptTopic, resolveGoal } from "../revision/goal";
import { countDone, doneTopics } from "../store";
import type { Topic } from "../types";
import { Icon } from "./Icon";
import { isDarkNow } from "../useTheme";

// The roadmap's prerequisite graph, as a mermaid flowchart. Mermaid is a
// large chunk, so it is only imported once the panel is first opened.
export function TopicMap({ topics }: { topics: Topic[] }) {
  const { store, v2Store } = useStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const goal = resolveGoal(v2Store.settings);
  const goalKey = JSON.stringify(goal);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const done = doneTopics(topics, store, goal);
    const n = (id: string) => id.replace(/-/g, "_");
    const lines = ["flowchart LR"];
    // Topics with nothing from the chosen sheet are left off, edges included.
    const shown = topics.filter((t) => goalScoped(t.patterns.flatMap((p) => p.problems), goal).length);
    const ids = new Set(shown.map((t) => t.id));
    for (const t of shown) {
      const problems = goalScoped(t.patterns.flatMap((p) => p.problems), goal);
      const solved = countDone(problems, store);
      // Green means finished; an exempt topic never blocks anything, but isn't that.
      const cls = done.has(t.id) && !isExemptTopic(t.id) ? "done" : solved ? "wip" : "todo";
      lines.push(`  ${n(t.id)}["${t.name.replace(/"/g, "'")}<br/>${solved}/${problems.length}"]:::${cls}`);
      for (const p of t.prereqs ?? []) if (ids.has(p)) lines.push(`  ${n(p)} --> ${n(t.id)}`);
    }
    lines.push(
      "  classDef done fill:#0d7a49,stroke:#0d7a49,color:#fff",
      "  classDef wip fill:#f5bf4a,stroke:#93650a,color:#14141c",
      "  classDef todo fill:transparent"
    );
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, theme: isDarkNow() ? "dark" : "default" });
        const { svg } = await mermaid.render(`topic-map-${Date.now()}`, lines.join("\n"));
        if (!cancelled && host.current) host.current.innerHTML = svg;
      })
      .catch((e: unknown) => {
        console.warn("topic map", e);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // goalKey, not goal: resolveGoal builds a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topics, store, goalKey]);

  return (
    <details className="group/map card mb-3 overflow-hidden" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="disclosure flex items-center gap-2 py-3 px-4 hover:bg-row-hover">
        <Icon name="layers" className="size-4 text-accent shrink-0" />
        <span className="font-display text-head font-bold">Topic map</span>
        <span className="text-caption text-muted max-sm:hidden">what to finish before what</span>
        <Icon name="chevronDown" className="size-4 text-faint ml-auto transition-transform group-open/map:rotate-180" />
      </summary>
      <div className="border-t border-border p-3 overflow-x-auto">
        {error ? (
          <p className="text-caption text-muted m-0">The topic map couldn't be drawn.</p>
        ) : (
          <div ref={host} className="min-h-24 text-caption text-muted [&_svg]:max-w-none">
            Drawing…
          </div>
        )}
      </div>
    </details>
  );
}
