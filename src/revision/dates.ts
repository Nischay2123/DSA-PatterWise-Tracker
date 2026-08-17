// UTC-only day arithmetic for the revision scheduler. Deliberately separate
// from store.ts's heatmap dates (which use local-calendar days on purpose,
// to match what the user visually sees as "today"): interval math here must
// be DST-proof, so every calculation goes through Date.UTC and whole-day
// millisecond arithmetic, never local Date mutation.

export function todayISOUTC(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function toUTCms(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysUTC(isoDate: string, days: number): string {
  return new Date(toUTCms(isoDate) + days * 86_400_000).toISOString().slice(0, 10);
}

// Whole days from `fromIso` to `toIso` (positive if `toIso` is later).
export function daysBetweenUTC(fromIso: string, toIso: string): number {
  return Math.round((toUTCms(toIso) - toUTCms(fromIso)) / 86_400_000);
}
