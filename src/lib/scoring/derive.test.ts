import { describe, expect, it } from "vitest";
import { deriveActuals, unresolvedKnockouts, winnerLoser } from "./derive";
import type { DbMatch } from "./derive";

let idc = 0;
function gm(
  group: string,
  home: string,
  away: string,
  hs: number | null,
  as_: number | null,
  status: DbMatch["status"] = "FINISHED",
): DbMatch {
  return {
    id: `g${idc++}`,
    stage: "GROUP",
    group,
    homeTeamId: home,
    awayTeamId: away,
    homeScore: hs,
    awayScore: as_,
    winnerTeamId: null,
    status,
  };
}
function km(
  stage: string,
  home: string,
  away: string,
  hs: number | null,
  as_: number | null,
  winner: string | null = null,
  status: DbMatch["status"] = "FINISHED",
): DbMatch {
  return {
    id: `k${idc++}`,
    stage,
    group: null,
    homeTeamId: home,
    awayTeamId: away,
    homeScore: hs,
    awayScore: as_,
    winnerTeamId: winner,
    status,
  };
}

// A complete group where H1 wins, H2 second, H3 third, H4 last.
function completeGroup(g: string, t: [string, string, string, string]): DbMatch[] {
  const [a, b, c, d] = t;
  return [
    gm(g, a, b, 1, 0),
    gm(g, a, c, 1, 0),
    gm(g, a, d, 1, 0),
    gm(g, b, c, 1, 0),
    gm(g, b, d, 1, 0),
    gm(g, c, d, 1, 0),
  ];
}

describe("winnerLoser", () => {
  it("uses explicit winnerTeamId (penalties)", () => {
    expect(winnerLoser(km("R32", "A", "B", 1, 1, "B")).winner).toBe("B");
  });
  it("infers from score when no draw", () => {
    expect(winnerLoser(km("R32", "A", "B", 2, 0)).winner).toBe("A");
  });
  it("returns null for a finished draw with no winner set", () => {
    expect(winnerLoser(km("R32", "A", "B", 1, 1)).winner).toBeNull();
  });
  it("returns null for unfinished", () => {
    expect(winnerLoser(km("R32", "A", "B", null, null, null, "SCHEDULED")).winner).toBeNull();
  });
});

describe("group derivation", () => {
  it("does not finalize an incomplete group", () => {
    const matches = [gm("A", "W", "X", 1, 0), gm("A", "W", "Y", null, null, "SCHEDULED")];
    const a = deriveActuals(matches);
    expect(a.groupsFinalized).toEqual([]);
    expect(a.groupStandings).toEqual([]);
  });

  it("derives order for a complete group", () => {
    const a = deriveActuals(completeGroup("A", ["A1", "A2", "A3", "A4"]));
    expect(a.groupsFinalized).toEqual(["A"]);
    const order = a.groupStandings.sort((x, y) => x.position - y.position).map((s) => s.teamId);
    expect(order).toEqual(["A1", "A2", "A3", "A4"]);
  });

  it("finalizes best-thirds only when every group is complete", () => {
    const partial = deriveActuals([
      ...completeGroup("A", ["A1", "A2", "A3", "A4"]),
      gm("B", "B1", "B2", null, null, "SCHEDULED"),
    ]);
    expect(partial.bestThirdsFinalized).toBe(false);

    const all = deriveActuals([
      ...completeGroup("A", ["A1", "A2", "A3", "A4"]),
      ...completeGroup("B", ["B1", "B2", "B3", "B4"]),
    ]);
    expect(all.bestThirdsFinalized).toBe(true);
    // both third-placed teams qualify (fewer than 8 thirds exist)
    expect(all.bestThirds.sort()).toEqual(["A3", "B3"]);
  });
});

describe("knockout derivation (audit fix)", () => {
  // 16 resolved R32 matches => R16 finalized with 16 survivors.
  const sixteenResolved = Array.from({ length: 16 }, (_, i) =>
    km("R32", `H${i}`, `A${i}`, 2, 0),
  );

  it("finalizes R16 when all 16 R32 matches resolve", () => {
    const a = deriveActuals(sixteenResolved);
    expect(a.advance.filter((x) => x.round === "R16")).toHaveLength(16);
    expect(a.advanceFinalized).toContain("R16");
  });

  it("does NOT finalize and drops only the unresolved survivor on a winner-less FINISHED match", () => {
    const matches = [...sixteenResolved];
    // make one a finished draw with no winner set
    matches[0] = km("R32", "H0", "A0", 1, 1);
    const a = deriveActuals(matches);
    expect(a.advance.filter((x) => x.round === "R16")).toHaveLength(15); // one dropped
    expect(a.advanceFinalized).not.toContain("R16"); // round stays OPEN (ceiling preserved)
    expect(unresolvedKnockouts(matches).map((m) => m.id)).toEqual([matches[0].id]);
  });

  it("derives final + third place from those matches", () => {
    const a = deriveActuals([
      km("FINAL", "C", "R", 2, 1),
      km("THIRD", "T", "L", 1, 0),
    ]);
    expect(a.final).toEqual({ championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "T" });
  });
});
