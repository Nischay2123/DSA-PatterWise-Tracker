import gfgLinks from "../data/gfgLinks.json";
import type { Problem } from "./types";

// data/questions.json is frozen, and 213 of its rows carry `link: null`
// because the sheet only ever recorded a LeetCode URL. Where the same
// problem exists on GeeksforGeeks practice, its id is mapped here instead of
// editing the frozen dataset. Every URL was resolved against the GFG
// practice catalog and fetched, so none of them are guessed slugs.
//
// Only genuinely equal problems are mapped -- a near-match (max-heap for a
// min-heap exercise, "Combination Sum IV" for "Combination Sum") is left
// unlinked rather than silently pointing somewhere else.
const GFG = gfgLinks as Record<string, string>;

/** The sheet's own link, else a verified GeeksforGeeks equivalent. */
export function problemLink(problem: Problem): string | null {
  return problem.link ?? GFG[problem.id] ?? null;
}

const SITES: [string, string][] = [
  ["leetcode.com", "LC"],
  ["geeksforgeeks.org", "GFG"],
  ["takeuforward.org", "TUF"],
  ["lintcode.com", "LintCode"],
];

/** Short label for a practice link's site. */
export function siteLabel(url: string): string {
  return SITES.find(([host]) => url.includes(host))?.[1] ?? "Link";
}
