import { getFundamentalsForPattern } from "../revision/session";
import { Icon } from "./Icon";

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
    <details className="group/fundamentals mb-2">
      <summary
        className="disclosure inline-flex items-center gap-1.5 rounded-full border border-border bg-bg
          py-1 px-2.5 text-micro font-semibold text-muted hover:text-accent hover:border-accent-line"
      >
        <Icon name="brain" className="size-3.5" />
        Fundamentals
        <span className="tabular-nums text-faint">{concepts.length}</span>
        <Icon
          name="chevronDown"
          className="size-3 transition-transform group-open/fundamentals:rotate-180"
        />
      </summary>
      <div className="mt-2 mb-3 rounded-lg border border-border bg-sunken p-3">
        {concepts.map((concept) => (
          <div key={concept.id} className="mb-3 last:mb-0">
            <div className="text-ui font-semibold flex items-start gap-2">
              <span className="min-w-0">{concept.prompt}</span>
              {concept.criticality === "core" && (
                <span className="pill bg-accent-soft text-accent shrink-0 uppercase tracking-wider">core</span>
              )}
            </div>
            <ul className="list-none p-0 mt-1.5 mb-0 flex flex-col gap-1">
              {concept.expectedConcepts.map((point) => (
                <li key={point} className="flex items-start gap-1.5 text-caption text-muted">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent/50" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
