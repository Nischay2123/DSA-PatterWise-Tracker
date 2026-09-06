import { getFundamentalsForPattern } from "../revision/session";

// Makes data/fundamentals.json readable while simply browsing the tracker.
// Until this existed, the 550 authored concepts were only reachable from
// inside a revision session -- 4 at a time, and only once a topic was both
// >=75% complete and due -- so in practice most of the material could never
// be read at all.
//
// Deliberately NOT marked data-accordion: useFilterAccordions force-opens
// every [data-accordion] whose subtree has a visible .problem-row and
// snapshots its state to restore later. This panel is neither a problem list
// nor something a search should fling open, so it stays outside that system.
export function FundamentalsPanel({ patternId }: { patternId: string }) {
  const concepts = getFundamentalsForPattern(patternId);
  if (concepts.length === 0) return null;

  return (
    <details className="group/fundamentals mb-1.5">
      <summary
        className="disclosure inline-flex items-center gap-1.5 py-1 text-caption text-muted hover:text-fg
          before:content-['▸'] before:text-micro group-open/fundamentals:before:content-['▾']"
      >
        Fundamentals ({concepts.length})
      </summary>
      <div className="mt-1 mb-2 pl-3 border-l-2 border-border">
        {concepts.map((concept) => (
          <div key={concept.id} className="mb-2.5 last:mb-0">
            <div className="text-ui font-semibold flex items-start gap-2">
              <span>{concept.prompt}</span>
              {concept.criticality === "core" && (
                <span className="mt-px text-micro uppercase tracking-wider text-accent font-semibold shrink-0">core</span>
              )}
            </div>
            <ul className="list-disc pl-4 my-1 text-caption text-muted">
              {concept.expectedConcepts.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
