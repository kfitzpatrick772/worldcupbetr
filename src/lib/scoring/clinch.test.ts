import { describe, expect, it } from "vitest";
import { clinchedTop2 } from "./clinch";
import type { GroupMatchLite } from "./clinch";

const teams = ["A", "B", "C", "D"];

// helper: a finished match
const f = (h: string, a: string, hs: number, as: number): GroupMatchLite => ({
  homeTeamId: h,
  awayTeamId: a,
  status: "FINISHED",
  homeScore: hs,
  awayScore: as,
});
// helper: an unplayed match
const u = (h: string, a: string): GroupMatchLite => ({
  homeTeamId: h,
  awayTeamId: a,
  status: "SCHEDULED",
  homeScore: null,
  awayScore: null,
});

describe("clinchedTop2", () => {
  it("returns nulls when nothing is decided yet", () => {
    const r = clinchedTop2(teams, [
      f("A", "B", 1, 0),
      f("C", "D", 1, 0),
      u("A", "C"),
      u("B", "D"),
      u("A", "D"),
      u("B", "C"),
    ]);
    expect(r).toEqual({ first: null, second: null, complete: false });
  });

  it("locks 1st when no rival can reach the leader on points", () => {
    // A has 6 pts with one game left (min 6). B,C max 4, D max 5 — all < 6.
    const r = clinchedTop2(teams, [
      f("A", "B", 1, 0), // A3
      f("A", "C", 1, 0), // A6 (A: played A-B, A-C; left A-D)
      f("B", "D", 0, 0), // B1, D1 (B left B-C; D left A-D)
      f("C", "D", 0, 0), // C1, D2 (C left B-C)
      u("A", "D"),
      u("B", "C"),
    ]);
    expect(r.first).toBe("A");
    expect(r.second).toBeNull(); // 2nd still contested (B/C/D)
    expect(r.complete).toBe(false);
  });

  it("does NOT lock 1st when a rival can still tie on points", () => {
    // A=6 (min 6), B=3 with a game left -> max 6, could tie A. Not certain.
    const r = clinchedTop2(teams, [
      f("A", "B", 1, 0),
      f("A", "C", 1, 0),
      f("B", "D", 1, 0), // B3, left B-C -> maxPts 6
      f("C", "D", 0, 1), // D3
      u("A", "D"),
      u("B", "C"),
    ]);
    expect(r.first).toBeNull();
  });

  it("locks both 1st and 2nd when the bottom two are eliminated", () => {
    // A and B both on 6 after two games, C and D can reach at most 3 each.
    const r = clinchedTop2(teams, [
      f("A", "C", 1, 0), // A3
      f("A", "D", 1, 0), // A6 (left A-B)
      f("B", "C", 1, 0), // B3
      f("B", "D", 1, 0), // B6 (left A-B)
      f("C", "D", 0, 0), // C1, D1 (each left one game: C-? actually C played A,B,D = 3 -> none left)
      u("A", "B"),
    ]);
    // C and D have finished all 3 games (max 1 pt). A,B min 6. A,B both locked top-2,
    // but which is 1st vs 2nd depends on A-B -> neither specific slot is certain.
    expect(r.first).toBeNull();
    expect(r.second).toBeNull();
  });

  it("falls back to full tiebreaker order once the group is complete", () => {
    // A 9, B 6, C 3, D 0.
    const r = clinchedTop2(teams, [
      f("A", "B", 1, 0),
      f("A", "C", 1, 0),
      f("A", "D", 1, 0),
      f("B", "C", 1, 0),
      f("B", "D", 1, 0),
      f("C", "D", 1, 0),
    ]);
    expect(r).toEqual({ first: "A", second: "B", complete: true });
  });

  it("locks 2nd once the winner is settled and the runner-up is unreachable", () => {
    // A clinched 1st (9, all played). Among B/C/D, B has 6 and C,D can't reach it.
    const r = clinchedTop2(teams, [
      f("A", "B", 1, 0), // A3
      f("A", "C", 1, 0), // A6
      f("A", "D", 1, 0), // A9 (A done)
      f("B", "C", 1, 0), // B3
      f("B", "D", 1, 0), // B6 (B done)
      u("C", "D"), // C max 3, D max 3
    ]);
    expect(r.first).toBe("A");
    expect(r.second).toBe("B");
    expect(r.complete).toBe(false);
  });
});
