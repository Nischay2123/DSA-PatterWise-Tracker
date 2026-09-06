import { useState } from "react";
import questionsData from "../data/questions.json";
import { Dashboard } from "./components/Dashboard";
import { Drawer } from "./components/Drawer";
import { Filters } from "./components/Filters";
import { Icon } from "./components/Icon";
import { MergeImport } from "./components/MergeImport";
import { BrandMark, SidebarContent } from "./components/Sidebar";
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
    <div className="grid h-screen place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted text-body">
        <BrandMark className="size-11 motion-safe:animate-pulse" />
        Loading your progress…
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: string | null }) {
  const exportRaw = () => {
    const raw = localStorage.getItem("dsa-tracker-progress");
    if (raw) downloadBackupFile(raw);
  };
  return (
    <div className="mx-auto mt-20 max-w-panel px-5">
      <div className="card p-6 text-center shadow-panel">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-hard-soft text-hard">
          <Icon name="alert" className="size-5" />
        </span>
        <h1 className="text-title font-bold mb-2">Couldn't load your progress</h1>
        <p className="text-body text-muted mb-2">
          Something went wrong migrating your saved data, so nothing was overwritten. Your original progress is still
          safe in this browser.
        </p>
        {error && (
          <p className="card-inset mb-4 p-2 font-mono text-caption text-muted break-words">{error}</p>
        )}
        <button type="button" onClick={exportRaw} className="btn btn-primary mx-auto">
          <Icon name="download" className="size-4" />
          Export raw progress as JSON
        </button>
      </div>
    </div>
  );
}

export function App() {
  const { store, dispatch, importNonce, status, bootError, v2Store, dispatchV2 } = useProgressStore();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [backupExists, setBackupExists] = useState(() => hasBackupV2());
  const [hash, navigate] = useHash();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

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

  const goto = (h: string) => {
    setNavOpen(false);
    navigate(h);
  };

  const sidebar = (showBrand: boolean) => (
    <SidebarContent
      route="tracker"
      showBrand={showBrand}
      onNavigate={goto}
      done={overallDone}
      total={overallTotal}
      backupExists={backupExists}
      onBackupChange={refreshBackup}
      onOpenSettings={() => {
        setNavOpen(false);
        setSettingsOpen(true);
      }}
    />
  );

  return (
    <StoreContext.Provider value={{ store, dispatch, v2Store, dispatchV2 }}>
      <FiltersContext.Provider value={{ filters, setFilters }}>
        {/* The whole chrome moved out of the top of the screen and into a
            persistent left rail. On a phone the rail becomes a drawer and
            only a slim app bar remains, which is a whole row of vertical
            space back on the smallest screen. */}
        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden lg:block sticky top-0 h-screen border-r border-border bg-surface/70 backdrop-blur-xl">
            {sidebar(true)}
          </aside>

          <div className="min-w-0">
            {/* Mobile app bar. Desktop gets no top chrome at all — the rail
                already carries identity, progress and every action. */}
            <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2 h-13 px-3 border-b border-border bg-bg/85 backdrop-blur-xl">
              <button
                type="button"
                className="icon-btn"
                aria-label="Open navigation"
                aria-expanded={navOpen}
                onClick={() => setNavOpen(true)}
              >
                <Icon name="menu" className="size-5" />
              </button>
              <BrandMark className="size-7" />
              <span className="font-display text-body font-bold tracking-tight">DSA Tracker</span>
              <span className="ml-auto pill bg-accent-soft text-accent tabular-nums">
                {overallDone}/{overallTotal} · {overallPct}%
              </span>
            </div>

            <div className="sticky top-13 lg:top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-xl">
              <div className="mx-auto w-full max-w-shell px-3 md:px-6">
                <Filters />
              </div>
              {/* Overall progress as the toolbar's bottom border: the track IS
                  the border, so it costs no vertical space at all. */}
              <div className="h-[2px] w-full bg-border" role="presentation">
                <div
                  className="h-full bg-progress transition-[width] duration-500"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>

            <main className="mx-auto w-full max-w-shell px-3 md:px-6 pt-5 pb-20">
              <Dashboard allProblems={ALL_PROBLEMS} onContinue={jumpToProblem} />

              <div className="flex items-center gap-2 mt-7 mb-2.5">
                <h2 className="font-display text-title font-bold m-0">Problems</h2>
                <span className="chip tabular-nums">{visibleCount} shown</span>
              </div>

              <TopicList key={importNonce} topics={DATA.topics} />

              {visibleCount === 0 && (
                <div className="card grid place-items-center gap-2 py-14 text-center">
                  <span className="grid size-10 place-items-center rounded-xl bg-sunken text-faint">
                    <Icon name="search" className="size-5" />
                  </span>
                  <p className="text-body text-muted m-0">No problems match these filters.</p>
                  <button type="button" className="btn btn-sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    <Icon name="x" className="size-3.5" />
                    Clear filters
                  </button>
                </div>
              )}

              <footer className="mt-10 border-t border-border pt-5 text-center text-caption text-muted">
                <p className="m-0 flex items-center justify-center gap-1.5">
                  <Icon name="alert" className="size-3.5 shrink-0" />
                  Progress is saved in this browser only — no account, no sync. Export regularly as a backup.
                </p>
                <MergeImport onBackupChange={refreshBackup} />
              </footer>
            </main>
          </div>
        </div>

        <Drawer
          open={navOpen}
          onClose={() => setNavOpen(false)}
          side="left"
          title="DSA Tracker"
          icon={<Icon name="layers" className="size-4" />}
        >
          {sidebar(false)}
        </Drawer>

        <Drawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Settings"
          icon={<Icon name="settings" className="size-4" />}
        >
          <SettingsPanel />
        </Drawer>
      </FiltersContext.Provider>
    </StoreContext.Provider>
  );
}
