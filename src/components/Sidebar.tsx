import { useStore } from "../context";
import { cx } from "../cx";
import { GOAL_PRESETS, goalPresetId, isDefaultGoal, resolveGoal } from "../revision/goal";
import type { Theme } from "../useTheme";
import { Icon, type IconName } from "./Icon";
import { ImportExport } from "./ImportExport";
import { Ring } from "./Ring";

const THEMES: { id: Theme; label: string; icon: IconName }[] = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "System", icon: "monitor" },
];

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={cx(
        "grid place-items-center rounded-lg bg-accent text-accent-fg shrink-0 shadow-panel",
        className
      )}
      aria-hidden="true"
    >
      <Icon name="layers" className="size-[55%]" />
    </span>
  );
}

function ThemeToggle() {
  const { v2Store, dispatchV2 } = useStore();
  const active: Theme =
    v2Store.settings.theme === "light" || v2Store.settings.theme === "dark" ? v2Store.settings.theme : "system";

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex gap-0.5 rounded-lg border border-border bg-bg p-0.5"
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          aria-label={t.label}
          aria-pressed={active === t.id}
          onClick={() => dispatchV2({ type: "SET_SETTINGS", patch: { theme: t.id } })}
          className={cx(
            "flex-1 grid place-items-center h-7 rounded-md border-0 cursor-pointer transition-colors",
            active === t.id
              ? "bg-accent text-accent-fg"
              : "bg-transparent text-muted hover:text-fg hover:bg-row-hover"
          )}
        >
          <Icon name={t.icon} className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

// Shared by the desktop rail and the mobile navigation drawer, so the two can
// never drift into offering different actions.
export function SidebarContent({
  route,
  onNavigate,
  done,
  total,
  backupExists,
  onBackupChange,
  onOpenSettings,
  showBrand = true,
}: {
  route: "tracker" | "revision";
  onNavigate: (hash: string) => void;
  done: number;
  total: number;
  backupExists: boolean;
  onBackupChange: () => void;
  onOpenSettings: () => void;
  /** The drawer draws its own titled header, so it opts out of this one. */
  showBrand?: boolean;
}) {
  const { v2Store } = useStore();
  const pct = total ? done / total : 0;
  const goal = resolveGoal(v2Store.settings);
  const preset = GOAL_PRESETS.find((p) => p.id === goalPresetId(goal));
  const goalCaption = isDefaultGoal(goal) ? "problems solved" : `solved in ${preset?.label ?? "your goal"}`;

  return (
    <div className="flex h-full flex-col gap-5 p-4">
      {showBrand && (
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div className="min-w-0">
            <div className="font-display text-head font-bold tracking-tight leading-tight">DSA Tracker</div>
            <div className="text-micro text-faint leading-tight">Practice &amp; spaced revision</div>
          </div>
        </div>
      )}

      {/* The overall figure was a 12px string wedged between the title and the
          buttons. It is the one number the whole app is about, so it gets to
          be the largest thing in the chrome. */}
      <div className="card p-3.5 flex items-center gap-3.5">
        <Ring pct={pct} size={62} stroke={6}>
          <span className="font-display text-head font-bold tabular-nums leading-none">
            {Math.round(pct * 100)}
            <span className="text-micro font-semibold text-muted">%</span>
          </span>
        </Ring>
        <div className="min-w-0">
          <div className="font-display text-title font-bold tabular-nums leading-none">
            {done}
            <span className="text-body font-medium text-faint">/{total}</span>
          </div>
          {/* Names the goal the figure above is measured against -- without
              it "0/143" is a number with no explanation. */}
          <div className="text-micro text-muted mt-1 truncate">{goalCaption}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Sections">
        <button
          type="button"
          className="nav-item"
          aria-current={route === "tracker" ? "page" : undefined}
          onClick={() => onNavigate("#/tracker")}
        >
          <Icon name="layers" className="size-4" />
          Tracker
        </button>
        <button
          type="button"
          className="nav-item"
          aria-current={route === "revision" ? "page" : undefined}
          onClick={() => onNavigate("#/revision")}
        >
          <Icon name="repeat" className="size-4" />
          Revision
        </button>
      </nav>

      <div className="flex flex-col gap-0.5">
        <span className="field-label px-2.5">Your data</span>
        <ImportExport backupExists={backupExists} onBackupChange={onBackupChange} />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button type="button" className="nav-item" onClick={onOpenSettings}>
          <Icon name="settings" className="size-4" />
          Settings
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
