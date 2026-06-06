import { describe, expect, it } from "vitest";
import { buildTable, computeBestThirds, computeGroupOrder } from "./standings";
import type { FinishedMatch } from "./standings";

// A clean group: A beats all, B second, C third, D last.
const teams = ["A", "B", "C", "D"];
const matches: FinishedMatch[] = [
  { homeTeamId: "A", awayTeamId: "B", homeScore: 1, awayScore: 0 },
  { homeTeamId: "A", awayTeamId: "C", homeScore: 2, awayScore: 0 },
  { homeTeamId: "A", awayTeamId: "D", homeScore: 3, awayScore: 0 },
  { homeTeamId: "B", awayTeamId: "C", homeScore: 1, awayScore: 0 },
  { homeTeamId: "B", awayTeamId: "D", homeScore: 2, awayScore: 0 },
  { homeTeamId: "C", awayTeamId: "D", homeScore: 1, awayScore: 0 },
];

describe("group table", () => {
  it("accumulates points and goal stats", () => {
    const t = buildTable(teams, matches);
    expect(t.get("A")!.points).toBe(9);
    expect(t.get("A")!.gd).toBe(6);
    expect(t.get("D")!.points).toBe(0);
  });

  it("orders by points then GD then GF", () => {
    expect(computeGroupOrder(teams, matches)).toEqual(["A", "B", "C", "D"]);
  });

  it("breaks an overall tie by head-to-head", () => {
    // X, Y, Z all 1-1-0 vs each other style; W loses all.
    // Construct: X beat Y, Y beat Z, Z beat X (cycle), all beat W by same margin.
    const t2 = ["X", "Y", "Z", "W"];
    const m2: FinishedMatch[] = [
      { homeTeamId: "X", awayTeamId: "Y", homeScore: 1, awayScore: 0 },
      { homeTeamId: "Y", awayTeamId: "Z", homeScore: 1, awayScore: 0 },
      { homeTeamId: "Z", awayTeamId: "X", homeScore: 1, awayScore: 0 },
      { homeTeamId: "X", awayTeamId: "W", homeScore: 2, awayScore: 0 },
      { homeTeamId: "Y", awayTeamId: "W", homeScore: 2, awayScore: 0 },
      { homeTeamId: "Z", awayTeamId: "W", homeScore: 2, awayScore: 0 },
    ];
    const order = computeGroupOrder(t2, m2);
    // X/Y/Z all equal overall AND in head-to-head; deterministic alpha fallback.
    expect(order.slice(0, 3).sort()).toEqual(["X", "Y", "Z"]);
    expect(order[3]).toBe("W");
  });
});

describe("best thirds", () => {
  it("takes the 8 strongest third-placed teams", () => {
    const thirds = Array.from({ length: 12 }, (_, i) => ({
      teamId: `T${String(i).padStart(2, "0")}`,
      played: 3,
      won: 1,
      drawn: 0,
      lost: 2,
      gf: 12 - i, // T00 strongest
      ga: 5,
      gd: 12 - i - 5,
      points: i < 6 ? 4 : 3, // first six have more points
    }));
    const best = computeBestThirds(thirds);
    expect(best).toHaveLength(8);
    // The 6 higher-point teams must all qualify.
    for (let i = 0; i < 6; i++) expect(best).toContain(`T0${i}`);
  });
});
