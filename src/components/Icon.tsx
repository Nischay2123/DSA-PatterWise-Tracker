import type { ReactNode } from "react";

// The app had no icons at all before this — only text labels and the ▸ / ▾
// characters. These are hand-drawn on a 24-unit grid at a 1.75 stroke so
// they hold up at 14–18px, and they inherit currentColor so a single
// `text-*` on the parent tints them.
//
// Inline SVG rather than an icon package: 20 paths is a smaller diff than a
// dependency, and it means no runtime font/sprite fetch.
const PATHS: Record<string, ReactNode> = {
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  star: (
    <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  ),
  chevronDown: <path d="M6 9.5 12 15.5 18 9.5" />,
  chevronRight: <path d="M9.5 6 15.5 12 9.5 18" />,
  chevronLeft: <path d="M14.5 6 8.5 12 14.5 18" />,
  arrowRight: (
    <>
      <path d="M4.5 12h15" />
      <path d="M13.5 6 19.5 12 13.5 18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8 20.5 20.5" />
    </>
  ),
  filter: <path d="M3.5 5.5h17l-6.5 7.6v6l-4 2.4v-8.4z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.2a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.4 1z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 21 8l-9 5-9-5z" />
      <path d="M3.5 12.5 12 17.3l8.5-4.8" />
      <path d="M3.5 16.7 12 21.5l8.5-4.8" />
    </>
  ),
  repeat: (
    <>
      <path d="M3.5 11.5A8.5 8.5 0 0 1 18 5.6l2.5 2.4" />
      <path d="M20.5 3.5v4.5H16" />
      <path d="M20.5 12.5A8.5 8.5 0 0 1 6 18.4L3.5 16" />
      <path d="M3.5 20.5V16H8" />
    </>
  ),
  flame: (
    <path d="M12 2.5s5.5 4.4 5.5 9.4a5.5 5.5 0 0 1-11 0c0-2 1-3.4 1-3.4s.4 1.7 1.8 2.2c0-3 2.7-5.5 2.7-8.2z" />
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8.5 14.5 11 17l4.5-4.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v2.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V17" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5v-11" />
      <path d="M7.5 9 12 4.5 16.5 9" />
      <path d="M4 17v2.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V17" />
    </>
  ),
  undo: (
    <>
      <path d="M4 9.5h10a5.5 5.5 0 0 1 0 11h-6" />
      <path d="M7.5 5.5 3.5 9.5l4 4" />
    </>
  ),
  merge: (
    <>
      <path d="M7 20.5V13a5 5 0 0 1 5-5h5" />
      <path d="M13.5 4.5 18 8.5l-4.5 4" />
      <circle cx="7" cy="4.5" r="2" />
    </>
  ),
  x: <path d="M6 6 18 18M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />,
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 20.5h7M12 17v3.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.2A1.2 1.2 0 0 1 10.7 3h2.6a1.2 1.2 0 0 1 1.2 1.2v2.3" />
      <path d="M6.5 6.5 7.4 20a1.2 1.2 0 0 0 1.2 1.1h6.8a1.2 1.2 0 0 0 1.2-1.1l.9-13.5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h5" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4z" />
      <path d="M20 4.5h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.2 2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 3.5A3 3 0 0 0 6.6 5.7 3 3 0 0 0 4.4 9a3 3 0 0 0 .3 4.2A3.2 3.2 0 0 0 6 18.6a3 3 0 0 0 5.5 1.6V4.9a2 2 0 0 0-2-1.4z" />
      <path d="M14.5 3.5a3 3 0 0 1 2.9 2.2A3 3 0 0 1 19.6 9a3 3 0 0 1-.3 4.2 3.2 3.2 0 0 1-1.3 5.4 3 3 0 0 1-5.5 1.6" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "size-4",
  filled = false,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
