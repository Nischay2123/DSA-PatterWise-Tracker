"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../context";
import { areTopicPrereqsMet, countDone, getTopicProblems } from "../store";
import { Icon } from "./Icon";
import type { Topic } from "../types";

export function TopicMap({ topics }: { topics: Topic[] }) {
  const { store } = useStore();
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;

    // Dynamic import mermaid only when needed
    import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          primaryColor: "var(--accent)",
          primaryTextColor: "var(--text)",
          primaryBorderColor: "var(--accent)",
          lineColor: "var(--border)",
          secondaryColor: "var(--panel)",
          tertiaryColor: "var(--bg)",
        },
      });

      const n = (id: string) => id.replace(/-/g, "_");
      const lines = ["flowchart LR"];

      for (const topic of topics) {
        const problems = getTopicProblems(topic);
        const done = countDone(problems, store);
        const total = problems.length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        areTopicPrereqsMet(topic, topics, store); // Check prereqs for potential future use

        let className = "todo";
        if (done === total && total > 0) className = "done";
        else if (done > 0) className = "wip";

        const label = `${topic.name}<br/>${done}/${total} (${pct}%)`;
        lines.push(`  ${n(topic.id)}["${label}"]:::${className}`);

        if (topic.prereqs) {
          for (const p of topic.prereqs) {
            lines.push(`  ${n(p)} --> ${n(topic.id)}`);
          }
        }
      }

      lines.push(
        '  classDef done fill:var(--ok),stroke:var(--ok),color:#fff',
        '  classDef wip fill:var(--medium),stroke:var(--medium),color:#fff',
        '  classDef todo fill:var(--panel),stroke:var(--border),color:var(--text)'
      );

      mermaid
        .render("topic-map-" + Date.now(), lines.join("\n"))
        .then(({ svg: svgContent }: { svg: string }) => {
          setSvg(svgContent);
        })
        .catch((e: unknown) => {
          console.warn("Topic map render error:", e);
          setError("Failed to render topic map");
        });
    });
  }, [topics, store]);

  return (
    <div className="card overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-head font-bold m-0">Topic Map</h3>
        <span className="text-caption text-muted">Prerequisite flow →</span>
      </div>
      <div
        ref={containerRef}
        className="p-3 overflow-x-auto"
        style={{ minHeight: 200 }}
      >
        {error && (
          <div className="flex items-center justify-center h-full text-muted">
            <Icon name="alert" className="size-5 mr-2" />
            {error}
          </div>
        )}
        {!error && !svg && (
          <div className="flex items-center justify-center h-full text-muted">
            <Icon name="loader" className="size-5 mr-2 animate-spin" />
            Loading topic map…
          </div>
        )}
        {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
    </div>
  );
}