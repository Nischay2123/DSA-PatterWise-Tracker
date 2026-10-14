import type { SweepCard, SweepRating } from "../types";

// The weekly sweep's spacing. Built to be run once a week: every card is due
// weekly until you know it, and a card you keep knowing drops out more and more,
// so the weekly pass stays about the same size as the sheet grows.
//
// Indexed by the "knew" streak: 0 or 1 -> weekly, 2 in a row -> fortnightly,
// 3 or more -> monthly. Fuzzy or blank resets the streak.
export const SWEEP_INTERVAL_DAYS = [7, 7, 14, 28] as const;

// One day of slack, so a card rated on a Sunday is due again on the next
// Saturday: a weekly sweep done a day early never skips the whole deck.
const SLACK_DAYS = 1;

export function rateSweep(prev: SweepCard | undefined, rating: SweepRating, at: string): SweepCard {
  return { at, rating, streak: rating === "knew" ? (prev?.streak ?? 0) + 1 : 0 };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function sweepIntervalDays(card: SweepCard): number {
  return SWEEP_INTERVAL_DAYS[Math.min(card.streak, SWEEP_INTERVAL_DAYS.length - 1)];
}

/** Never-rated cards are due. */
export function isSweepDue(card: SweepCard | undefined, today: string): boolean {
  return !card || daysBetween(card.at, today) >= sweepIntervalDays(card) - SLACK_DAYS;
}

// Two devices: the later rating is the true current state.
export function mergeSweep(a: SweepCard | undefined, b: SweepCard | undefined): SweepCard | undefined {
  if (!a || !b) return a ?? b;
  return b.at > a.at ? b : a;
}
