import { useEffect } from "react";

export type Theme = "light" | "dark" | "system";

// Mirrors settings.theme into localStorage purely so the head script in
// index.html can read it SYNCHRONOUSLY before first paint. IndexedDB is
// async and cannot be read that early, so without the mirror an explicit
// light/dark choice would flash the other theme on every load.
// IndexedDB remains the source of truth; this is write-through only.
const MIRROR_KEY = "dsa-tracker-theme";

export function isTheme(value: string): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

// Pass null until the store has actually booted.
//
// The trap this avoids: v2Store initialises to settings.theme === "system"
// before boot completes. Calling this unconditionally would strip the
// data-theme the head script just set and cause the very flash the head
// script exists to prevent.
export function useTheme(theme: string | null): void {
  useEffect(() => {
    if (theme === null) return;
    const resolved: Theme = isTheme(theme) ? theme : "system";

    // "system" means: no attribute, so :root's `color-scheme: light dark`
    // applies and follows the OS live -- no matchMedia listener needed.
    if (resolved === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = resolved;

    try {
      localStorage.setItem(MIRROR_KEY, resolved);
    } catch {
      // Private-mode Safari throws. A missing mirror only costs a flash.
    }
  }, [theme]);
}
