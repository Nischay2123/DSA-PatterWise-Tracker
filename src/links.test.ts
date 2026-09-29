import { describe, expect, it } from "vitest";
import gfgLinks from "../data/gfgLinks.json";
import questionsData from "../data/questions.json";
import { problemLink } from "./links";
import type { QuestionData } from "./types";

const PROBLEMS = (questionsData as QuestionData).topics.flatMap((t) => t.patterns.flatMap((p) => p.problems));
const BY_ID = new Map(PROBLEMS.map((p) => [p.id, p]));
const MAP = gfgLinks as Record<string, string>;

describe("gfg link map", () => {
  it("only maps ids that exist in the frozen dataset", () => {
    expect(Object.keys(MAP).filter((id) => !BY_ID.has(id))).toEqual([]);
  });

  // A mapped id that gained its own link would silently keep the GFG one
  // as dead weight, and the two could disagree.
  it("only maps problems the sheet left without a link", () => {
    expect(Object.keys(MAP).filter((id) => BY_ID.get(id)?.link)).toEqual([]);
  });

  it("maps only GeeksforGeeks practice URLs", () => {
    const bad = Object.values(MAP).filter((u) => !/^https:\/\/www\.geeksforgeeks\.org\/problems\/[\w-]+\/\d+$/.test(u));
    expect(bad).toEqual([]);
  });

  it("prefers the sheet's own link over the map", () => {
    const withLink = PROBLEMS.find((p) => p.link)!;
    expect(problemLink(withLink)).toBe(withLink.link);
  });

  it("falls back to the map, and to null when nothing is known", () => {
    const mapped = BY_ID.get(Object.keys(MAP)[0])!;
    expect(problemLink(mapped)).toBe(MAP[mapped.id]);
    const unmapped = PROBLEMS.find((p) => !p.link && !MAP[p.id])!;
    expect(problemLink(unmapped)).toBeNull();
  });
});
