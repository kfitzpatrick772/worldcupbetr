import { describe, expect, it } from "vitest";
import { matchFixture, normalizeName } from "./match";
import type { IndexableMatch } from "./match";

describe("normalizeName", () => {
  it("folds known synonyms and diacritics", () => {
    expect(normalizeName("South Korea")).toBe(normalizeName("Korea Republic"));
    expect(normalizeName("Türkiye")).toBe(normalizeName("Turkey"));
    expect(normalizeName("Côte d'Ivoire")).toBe(normalizeName("Ivory Coast"));
    expect(normalizeName("Bosnia and Herzegovina")).toBe(normalizeName("Bosnia & Herzegovina"));
    expect(normalizeName("Curaçao")).toBe("curacao");
    expect(normalizeName("DR Congo")).toBe(normalizeName("Congo DR"));
    expect(normalizeName("Cape Verde Islands")).toBe(normalizeName("Cape Verde"));
  });
});

const ours: IndexableMatch[] = [
  { id: "m1", externalRef: null, homeName: "Mexico", awayName: "South Africa", kickoff: new Date("2026-06-11T19:00:00Z") },
  { id: "m2", externalRef: "API-99", homeName: "Korea Republic", awayName: "Czechia", kickoff: new Date("2026-06-12T02:00:00Z") },
];

describe("matchFixture", () => {
  it("matches by externalRef first", () => {
    expect(matchFixture({ externalRef: "API-99", homeName: "x", awayName: "y" }, ours)).toBe("m2");
  });
  it("matches by team pair regardless of home/away order + name variant", () => {
    expect(
      matchFixture({ externalRef: "API-1", homeName: "South Africa", awayName: "Mexico" }, ours),
    ).toBe("m1");
  });
  it("matches South Korea variant", () => {
    expect(
      matchFixture({ externalRef: "API-2", homeName: "Czechia", awayName: "South Korea" }, ours),
    ).toBe("m2");
  });
  it("returns null when no pair matches", () => {
    expect(matchFixture({ externalRef: "z", homeName: "Brazil", awayName: "Spain" }, ours)).toBeNull();
  });
});
