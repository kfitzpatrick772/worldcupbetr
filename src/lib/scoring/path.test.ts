import { describe, expect, it } from "vitest";
import { analyzePaths, exactPaths } from "./path";
import type { PathPlayer, KnockoutState, KoSlot } from "./path";

const emptyState = (over: Partial<KnockoutState> = {}): KnockoutState => ({
  reached: { R16: new Set(), QF: new Set(), SF: new Set(), FINAL: new Set() },
  eliminatedAt: new Map(),
  final: { championId: null, runnerUpId: null, thirdId: null },
  finalizedRounds: new Set(),
  ...over,
});

const player = (over: Partial<PathPlayer>): PathPlayer => ({
  participantId: over.participantId ?? over.name ?? "p",
  name: over.name ?? "p",
  slug: (over.name ?? "p").toLowerCase(),
  locked: 0,
  groupPart: 0,
  advance: [],
  championId: null,
  runnerUpId: null,
  thirdId: null,
  ...over,
});

describe("stake classification", () => {
  const state = emptyState({
    reached: { R16: new Set(["BRA", "GER", "ESP"]), QF: new Set(["BRA", "GER", "ESP"]), SF: new Set(["BRA"]), FINAL: new Set() },
    eliminatedAt: new Map([["GER", "QF"]]),
  });

  it("marks a reached round as locked, an eliminated pick as dead, an open pick as live", () => {
    const p = player({
      name: "A",
      advance: [{ round: "SF", teamId: "BRA" }, { round: "SF", teamId: "GER" }, { round: "SF", teamId: "ESP" }],
      championId: "BRA",
    });
    const [row] = analyzePaths([p], state);
    const byTeam = Object.fromEntries(row.stakes.filter((s) => s.label === "Semi-final").map((s) => [s.teamId, s.status]));
    expect(byTeam.BRA).toBe("locked");
    expect(byTeam.GER).toBe("dead");
    expect(byTeam.ESP).toBe("live");
    // champion of a still-alive team is live
    expect(row.stakes.find((s) => s.label === "Champion")!.status).toBe("live");
  });
});

describe("tight max + elimination + clinch", () => {
  it("tightMax counts only live stakes on top of locked", () => {
    const p = player({
      name: "A", locked: 100,
      advance: [{ round: "FINAL", teamId: "ALIVE" }], // +80 live
      championId: "DEAD", // +160 but dead
    });
    const state = emptyState({ eliminatedAt: new Map([["DEAD", "QF"]]) });
    const [row] = analyzePaths([p], state);
    expect(row.tightMax).toBe(180); // 100 + 80 live; the 160 champion is dead
  });

  it("eliminates a player whose ceiling can't reach a rival's locked floor", () => {
    const a = player({ name: "A", locked: 50, advance: [{ round: "FINAL", teamId: "T" }] }); // max 130
    const b = player({ name: "B", locked: 140 }); // guaranteed 140 > 130
    const rows = analyzePaths([a, b], emptyState());
    const A = rows.find((r) => r.name === "A")!;
    expect(A.eliminated).toBe(true);
    expect(A.status).toBe("eliminated");
    expect(rows.find((r) => r.name === "B")!.eliminated).toBe(false);
  });

  it("clinches when a player's floor beats every rival's ceiling", () => {
    const a = player({ name: "A", locked: 300 });
    const b = player({ name: "B", locked: 120, advance: [{ round: "FINAL", teamId: "T" }], championId: "U" }); // max 120+80+160=360... make it below
    const rows = analyzePaths([a, b], emptyState({ eliminatedAt: new Map([["U", "QF"], ["T", "QF"]]) }));
    // B's picks are dead → B.tightMax = 120 < A.locked 300 → A clinched, B eliminated
    expect(rows.find((r) => r.name === "A")!.clinched).toBe(true);
    expect(rows.find((r) => r.name === "A")!.status).toBe("clinched");
    expect(rows.find((r) => r.name === "B")!.eliminated).toBe(true);
  });

  it("labels the current leader 'in control' when not yet clinched", () => {
    const a = player({ name: "A", locked: 120 });
    const b = player({ name: "B", locked: 100, advance: [{ round: "FINAL", teamId: "T" }] }); // max 180 can pass
    const rows = analyzePaths([a, b], emptyState());
    expect(rows.find((r) => r.name === "A")!.status).toBe("in_control");
    expect(rows.find((r) => r.name === "B")!.eliminated).toBe(false);
  });
});

describe("exact enumeration (final undecided)", () => {
  const slots = new Map<string, KoSlot>([
    ["M101", { slot: "M101", home: "X", away: "P", winner: "X" }],
    ["M102", { slot: "M102", home: "Y", away: "Q", winner: "Y" }],
    ["M103", { slot: "M103", home: "P", away: "Q", winner: "P" }],
    ["M104", { slot: "M104", home: null, away: null, winner: null }], // participants resolve to X vs Y
  ]);

  it("splits the win between the two champion-pickers and states the exact condition", () => {
    const a = player({ name: "A", championId: "X" });
    const b = player({ name: "B", championId: "Y" });
    const res = exactPaths([a, b], slots)!;
    expect(res.totalScenarios).toBe(2);
    const A = res.byPlayer.get("A")!;
    const B = res.byPlayer.get("B")!;
    expect(A.winShare).toBe(0.5);
    expect(A.mustHappen).toEqual([{ slot: "M104", teamId: "X" }]);
    expect(B.mustHappen).toEqual([{ slot: "M104", teamId: "Y" }]);
    expect(A.clinched).toBe(false);
    expect(A.eliminated).toBe(false);
  });

  it("reports clinched / eliminated when one player leads no matter what", () => {
    const a = player({ name: "A", groupPart: 300, championId: "X" }); // 300 base, always ahead
    const b = player({ name: "B", championId: "Y" }); // max 160
    const res = exactPaths([a, b], slots)!;
    expect(res.byPlayer.get("A")!.clinched).toBe(true);
    expect(res.byPlayer.get("A")!.mustHappen).toEqual([]); // nothing needs to happen
    expect(res.byPlayer.get("B")!.eliminated).toBe(true);
  });

  it("cascades through SF → final and reports exact win share + required results", () => {
    // QF decided: winners A,B,C,D → SF is A-vs-B (M101) and C-vs-D (M102).
    const s = new Map<string, KoSlot>([
      ["M97", { slot: "M97", home: "A", away: "x", winner: "A" }],
      ["M98", { slot: "M98", home: "B", away: "y", winner: "B" }],
      ["M99", { slot: "M99", home: "C", away: "z", winner: "C" }],
      ["M100", { slot: "M100", home: "D", away: "w", winner: "D" }],
      ["M101", { slot: "M101", home: null, away: null, winner: null }], // A vs B
      ["M102", { slot: "M102", home: null, away: null, winner: null }], // C vs D
      ["M103", { slot: "M103", home: null, away: null, winner: null }], // third
      ["M104", { slot: "M104", home: null, away: null, winner: null }], // final
    ]);
    const p1 = player({ name: "P1", groupPart: 10, championId: "A" });
    const p2 = player({ name: "P2", groupPart: 0, championId: "C" });
    const p3 = player({ name: "P3", groupPart: 5 }); // no picks — can't gain
    const res = exactPaths([p1, p2, p3], s)!;
    expect(res.totalScenarios).toBe(16); // 2^4 undecided games

    const P1 = res.byPlayer.get("P1")!;
    const P2 = res.byPlayer.get("P2")!;
    const P3 = res.byPlayer.get("P3")!;
    // P1 leads by 10 and also owns champion A: wins whenever A is champ OR nobody they trail scores → 12/16.
    expect(P1.winShare).toBeCloseTo(12 / 16);
    // P2 only wins if their champion C wins it all → C beats D (M102) AND C wins the final (M104).
    expect(P2.winShare).toBeCloseTo(4 / 16);
    expect(P2.mustHappen).toEqual([
      { slot: "M102", teamId: "C" },
      { slot: "M104", teamId: "C" },
    ]);
    // P3 can never gain → eliminated.
    expect(P3.eliminated).toBe(true);
    expect(P3.winShare).toBe(0);
  });

  it("returns null when the remaining bracket is too big to enumerate", () => {
    const big = new Map<string, KoSlot>();
    for (let i = 89; i <= 104; i++) big.set(`M${i}`, { slot: `M${i}`, home: "A", away: "B", winner: null });
    expect(exactPaths([player({ name: "A" })], big, 12)).toBeNull();
  });
});
