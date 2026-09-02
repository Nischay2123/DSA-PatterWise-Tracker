import { useState } from "react";
import questionsData from "../data/questions.json";
import { Dashboard } from "./components/Dashboard";
import { Filters } from "./components/Filters";
import { ImportExport } from "./components/ImportExport";
import { MergeImport } from "./components/MergeImport";
import { ProgressBar } from "./components/ProgressBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { SessionShell } from "./components/revision/SessionShell";
import { TopicList } from "./components/TopicList";
import { FiltersContext, StoreContext, useProgressStore } from "./context";
import { downloadBackupFile } from "./persistence/backup";
import { countDone, getState, hasBackupV2, isProblemVisible } from "./store";
import { useFilterAccordions } from "./useFilterAccordions";
import { useHash } from "./useHash";
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
    <div className="flex items-center justify-center h-screen text-muted text-[0.9rem]">Loading your progress…</div>
  );
}

function ErrorScreen({ error }: { error: string | null }) {
  const exportRaw = () => {
    const raw = localStorage.getItem("dsa-tracker-progress");
    if (raw) downloadBackupFile(raw);
  };
  return (
    <div className="max-w-[500px] mx-auto mt-20 px-5 text-center">
      <h1 className="text-[1.1rem] font-semibold mb-2">Couldn't load your progress</h1>
      <p className="text-[0.85rem] text-muted mb-1">
        Something went wrong migrating your saved data, so nothing was overwritten. Your original progress is still
        safe in this browser.
      </p>
      {error && <p className="text-[0.75rem] text-muted mb-4 font-mono break-words">{error}</p>}
      <button
        type="button"
        onClick={exportRaw}
        className="border border-border rounded-md px-3 py-1.5 text-[0.85rem] cursor-pointer bg-transparent text-fg"
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

  if (status === "loading") return <LoadingScreen />;
  if (status === "error") return <ErrorScreen error={bootError} />;

  const sessionMatch = /^#\/revision\/(.+)$/.exec(hash);
  const sessionTopic = sessionMatch ? DATA.topics.find((t) => t.id === decodeURIComponent(sessionMatch[1])) : null;

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
        <header className="sticky top-0 z-10 bg-bg border-b border-border px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[1.2rem] m-0">DSA Tracker</h1>
            <div className="flex items-center gap-2">
              <ImportExport backupExists={backupExists} onBackupChange={refreshBackup} />
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                title="Evaluation provider, API key and completion gate"
                className="text-[0.85rem] px-3 py-1.5 border border-border rounded-md bg-transparent text-fg cursor-pointer"
              >
                Settings
              </button>
            </div>
          </div>
          {settingsOpen && (
            <div className="max-w-[460px] ml-auto">
              <SettingsPanel onClose={() => setSettingsOpen(false)} />
            </div>
          )}
          <div className="flex items-center gap-2.5 mt-2.5">
            <ProgressBar done={overallDone} total={overallTotal} />
            <span className="text-[0.85rem] text-muted whitespace-nowrap">{`${overallDone}/${overallTotal} (${overallPct}%)`}</span>
          </div>
          <Filters />
        </header>
        <main className="max-w-[900px] mx-auto pt-4 px-5 pb-15">
          <Dashboard allProblems={ALL_PROBLEMS} onContinue={jumpToProblem} />
          <TopicList key={importNonce} topics={DATA.topics} />
          {visibleCount === 0 && (
            <p className="text-[0.85rem] text-muted text-center py-6">
              No problems match these filters.{" "}
              <button
                type="button"
                className="bg-transparent border-0 p-0 font-inherit text-fg underline cursor-pointer"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Clear filters
              </button>
            </p>
          )}
        </main>
        <footer className="text-center text-[0.75rem] text-muted p-5">
          <p className="m-0">
            Progress is saved in this browser only — no account, no sync. Use Export regularly as a backup.
          </p>
          <MergeImport onBackupChange={refreshBackup} />
        </footer>
      </FiltersContext.Provider>
    </StoreContext.Provider>
  );
}
