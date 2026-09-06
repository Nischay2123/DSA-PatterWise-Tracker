import { useState } from "react";
import questionsData from "../data/questions.json";
import { Dashboard } from "./components/Dashboard";
import { Filters } from "./components/Filters";
import { ImportExport } from "./components/ImportExport";
import { MergeImport } from "./components/MergeImport";
import { SettingsPanel } from "./components/SettingsPanel";
import { RevisionDashboard } from "./components/revision/Dashboard";
import { SessionShell } from "./components/revision/SessionShell";
import { TopicList } from "./components/TopicList";
import { FiltersContext, StoreContext, useProgressStore } from "./context";
import { downloadBackupFile } from "./persistence/backup";
import { countDone, getState, hasBackupV2, isProblemVisible } from "./store";
import { useFilterAccordions } from "./useFilterAccordions";
import { useTheme } from "./useTheme";
import { useHash } from "./useHash";
import { cx } from "./cx";
import type { FilterState, QuestionData } from "./types";

const DATA = questionsData as QuestionData;
const ALL_PROBLEMS = DATA.topics.flatMap((t) => t.patterns.flatMap((p) => p.problems));
const ALL_PROBLEMS_WITH_CONTEXT = DATA.topics.flatMap((t) =>
  t.patterns.flatMap((p) => p.problems.map((q) => ({ problem: q, topicName: t.name, patternName: p.name })))
);

const DEFAULT_FILTERS: FilterState = {
  search: "",
  difficulty: "All",
  importance: "All",
  freq: "All",
  hideCompleted: false,
  reviseOnly: false,
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function jumpToProblem(id: string) {
  const row = document.querySelector<HTMLElement>(`.problem-row[data-id="${id}"]`);
  if (!row) return;
  let node: HTMLElement | null = row.parentElement;
  while (node) {
    if (node.tagName === "DETAILS") (node as HTMLDetailsElement).open = true;
    node = node.parentElement;
  }
  row.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  row.classList.remove("just-jumped");
  void row.offsetWidth; // restart the highlight if the same row is targeted twice
  row.classList.add("just-jumped");
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen text-muted text-body">Loading your progress…</div>
  );
}

function ErrorScreen({ error }: { error: string | null }) {
  const exportRaw = () => {
    const raw = localStorage.getItem("dsa-tracker-progress");
    if (raw) downloadBackupFile(raw);
  };
  return (
    <div className="max-w-panel mx-auto mt-20 px-5 text-center">
      <h1 className="text-title font-semibold mb-2">Couldn't load your progress</h1>
      <p className="text-body text-muted mb-1">
        Something went wrong migrating your saved data, so nothing was overwritten. Your original progress is still
        safe in this browser.
      </p>
      {error && <p className="text-caption text-muted mb-4 font-mono break-words">{error}</p>}
      <button
        type="button"
        onClick={exportRaw}
        className="btn"
      >
        Export raw progress as JSON
      </button>
    </div>
  );
}

export function App() {
  const { store, dispatch, importNonce, status, bootError, v2Store, dispatchV2 } = useProgressStore();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [backupExists, setBackupExists] = useState(() => hasBackupV2());
  const [hash, navigate] = useHash();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const overallDone = countDone(ALL_PROBLEMS, store);
  const overallTotal = ALL_PROBLEMS.length;
  const overallPct = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0;

  const visibleCount = ALL_PROBLEMS_WITH_CONTEXT.filter(({ problem, topicName, patternName }) =>
    isProblemVisible(problem, getState(store, problem.id), filters, { topicName, patternName })
  ).length;

  const refreshBackup = () => setBackupExists(hasBackupV2());

  useFilterAccordions(filters);
  // Gated on `ready`: before boot, v2Store holds the default "system", and
  // applying that would strip the data-theme index.html's head script just
  // set -- causing the very flash that script exists to prevent.
  useTheme(status === "ready" ? v2Store.settings.theme : null);

  if (status === "loading") return <LoadingScreen />;
  if (status === "error") return <ErrorScreen error={bootError} />;

  const sessionMatch = /^#\/revision\/(.+)$/.exec(hash);
  const sessionTopic = sessionMatch ? DATA.topics.find((t) => t.id === decodeURIComponent(sessionMatch[1])) : null;

  if (!sessionTopic && /^#\/revision\/?$/.test(hash)) {
    return (
      <StoreContext.Provider value={{ store, dispatch, v2Store, dispatchV2 }}>
        <RevisionDashboard
          topics={DATA.topics}
          onExit={() => navigate("#/tracker")}
          onStartRevision={(topicId) => navigate(`#/revision/${encodeURIComponent(topicId)}`)}
        />
      </StoreContext.Provider>
    );
  }

  if (sessionTopic) {
    return (
      <StoreContext.Provider value={{ store, dispatch, v2Store, dispatchV2 }}>
        <SessionShell
          topic={sessionTopic}
          onExit={() => navigate("#/tracker")}
          onOpenSettings={() => {
            setSettingsOpen(true);
            navigate("#/tracker");
          }}
        />
      </StoreContext.Provider>
    );
  }

  return (
    <StoreContext.Provider value={{ store, dispatch, v2Store, dispatchV2 }}>
      <FiltersContext.Provider value={{ filters, setFilters }}>
        {/* Two rows, not three: the progress bar became the header's bottom
            edge, which frees a whole row on a phone. scroll-mt-* on the rows
            is tuned to this height -- change one, change the other. */}
        <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-shell px-4 md:px-6">
            <div className="flex items-center gap-x-3 gap-y-2 py-2.5 flex-wrap">
              <h1 className="text-title font-semibold tracking-tight m-0">DSA Tracker</h1>
              <span className="text-caption text-muted tabular-nums" aria-label={`${overallDone} of ${overallTotal} solved`}>
                {overallDone}
                <span className="opacity-60">/{overallTotal}</span> · {overallPct}%
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <ImportExport backupExists={backupExists} onBackupChange={refreshBackup} />
                <button type="button" className="btn" onClick={() => navigate("#/revision")} title="Revision dashboard">
                  Revision
                </button>
                <button
                  type="button"
                  className={cx("btn", settingsOpen && "btn-primary")}
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((o) => !o)}
                  title="Theme, evaluation provider, API key and completion gate"
                >
                  Settings
                </button>
              </div>
            </div>
            <Filters />
            {settingsOpen && (
              <div className="pb-3">
                <div className="ml-auto w-full max-w-panel">
                  <SettingsPanel onClose={() => setSettingsOpen(false)} />
                </div>
              </div>
            )}
          </div>
          {/* Overall progress as the header's bottom border: the track IS the
              border, so this costs no vertical space at all. */}
          <div className="h-[3px] w-full bg-border" role="presentation">
            <div
              className="h-full bg-progress transition-[width] duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-shell px-4 md:px-6 pt-5 pb-16">
          <Dashboard allProblems={ALL_PROBLEMS} onContinue={jumpToProblem} />
          <TopicList key={importNonce} topics={DATA.topics} />
          {visibleCount === 0 && (
            <p className="text-body text-muted text-center py-10">
              No problems match these filters.{" "}
              <button type="button" className="btn-link" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </button>
            </p>
          )}
        </main>

        <footer className="mx-auto w-full max-w-shell px-4 md:px-6 pb-10 text-center text-caption text-muted">
          <p className="m-0">
            Progress is saved in this browser only — no account, no sync. Use Export regularly as a backup.
          </p>
          <MergeImport onBackupChange={refreshBackup} />
        </footer>
      </FiltersContext.Provider>
    </StoreContext.Provider>
  );
}
