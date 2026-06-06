import { describe, expect, it } from "vitest";
import { POINTS, scoreAll, scoreParticipant } from "./engine";
import type { Actuals, MatchResult, ParticipantPicks } from "./types";

// ---- helpers ---------------------------------------------------------------

function emptyActuals(over: Partial<Actuals> = {}): Actuals {
  return {
    groupStandings: [],
    groupsFinalized: [],
    bestThirds: [],
    bestThirdsFinalized: false,
    advance: [],
    advanceFinalized: [],
    final: { championTeamId: null, runnerUpTeamId: null, thirdPlaceTeamId: null },
    ...over,
  };
}

function emptyPicks(over: Partial<ParticipantPicks> = {}): ParticipantPicks {
  return {
    participantId: "p1",
    groupMatch: [],
    groupStanding: [],
    bestThird: [],
    advance: [],
    final: null,
    ...over,
  };
}

function gm(
  id: string,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchResult["status"] = "FINISHED",
): MatchResult {
  return {
    id,
    stage: "GROUP",
    group: "A",
    homeTeamId: "H",
    awayTeamId: "AW",
    homeScore,
    awayScore,
    status,
  };
}

const map = (...ms: MatchResult[]) => new Map(ms.map((m) => [m.id, m]));

// ---- group-stage match results (rulebook worked examples) ------------------

describe("group match scoring", () => {
  it("correct winner = 2 (England win predicted, England wins)", () => {
    const r = scoreParticipant(
      emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 1, predAway: 0 }] }),
      map(gm("m1", 3, 0)), // home wins, not exact
      emptyActuals(),
    );
    expect(r.lockedPoints).toBe(2);
    expect(r.lines[0].detail).toBe("Correct result");
  });

  it("exact scoreline = 4 (predicted 2-1, actual 2-1)", () => {
    const r = scoreParticipant(
      emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 2, predAway: 1 }] }),
      map(gm("m1", 2, 1)),
      emptyActuals(),
    );
    expect(r.lockedPoints).toBe(4);
    expect(r.lines[0].detail).toBe("Exact scoreline");
  });

  it("predicted draw, match ends draw = 2", () => {
    const r = scoreParticipant(
      emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 0, predAway: 0 }] }),
      map(gm("m1", 1, 1)),
      emptyActuals(),
    );
    expect(r.lockedPoints).toBe(2);
  });

  it("exact draw = 4", () => {
    const r = scoreParticipant(
      emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 1, predAway: 1 }] }),
      map(gm("m1", 1, 1)),
      emptyActuals(),
    );
    expect(r.lockedPoints).toBe(4);
  });

  it("wrong result = 0 (no line emitted)", () => {
    const r = scoreParticipant(
      emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 2, predAway: 0 }] }),
      map(gm("m1", 0, 1)),
      emptyActuals(),
    );
    expect(r.lockedPoints).toBe(0);
    expect(r.lines).toHaveLength(0);
  });

  it("scheduled match scores nothing", () => {
    const r = scoreParticipant(
      emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 1, predAway: 0 }] }),
      map(gm("m1", null, null, "SCHEDULED")),
      emptyActuals(),
    );
    expect(r.lines).toHaveLength(0);
  });

  it("LIVE match counts as provisional (live not locked)", () => {
    const r = scoreParticipant(
      emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 2, predAway: 1 }] }),
      map(gm("m1", 2, 1, "LIVE")),
      emptyActuals(),
    );
    expect(r.livePoints).toBe(4);
    expect(r.lockedPoints).toBe(0);
    expect(r.lines[0].provisional).toBe(true);
  });
});

// ---- group advancement -----------------------------------------------------

describe("group advancement", () => {
  const standings = (group: string, first: string, second: string) => [
    { group, position: 1, teamId: first },
    { group, position: 2, teamId: second },
  ];

  it("England 1st / USA 2nd exactly right = 15 (rulebook example)", () => {
    const r = scoreParticipant(
      emptyPicks({
        groupStanding: [
          { group: "A", position: 1, teamId: "ENG" },
          { group: "A", position: 2, teamId: "USA" },
        ],
      }),
      map(),
      emptyActuals({
        groupStandings: standings("A", "ENG", "USA"),
        groupsFinalized: ["A"],
      }),
    );
    expect(r.lockedPoints).toBe(15);
    expect(r.lines.filter((l) => l.category === "GROUP_ADVANCE")).toHaveLength(2);
  });

  it("both advance but slots swapped = 10 (no winner/runner-up bonus)", () => {
    const r = scoreParticipant(
      emptyPicks({
        groupStanding: [
          { group: "A", position: 1, teamId: "USA" },
          { group: "A", position: 2, teamId: "ENG" },
        ],
      }),
      map(),
      emptyActuals({
        groupStandings: standings("A", "ENG", "USA"),
        groupsFinalized: ["A"],
      }),
    );
    expect(r.lockedPoints).toBe(10);
  });

  it("one pick misses top-2 = 5 + possible bonus", () => {
    const r = scoreParticipant(
      emptyPicks({
        groupStanding: [
          { group: "A", position: 1, teamId: "ENG" }, // correct winner
          { group: "A", position: 2, teamId: "WAL" }, // misses
        ],
      }),
      map(),
      emptyActuals({
        groupStandings: standings("A", "ENG", "USA"),
        groupsFinalized: ["A"],
      }),
    );
    // ENG advance (5) + correct winner (3) = 8
    expect(r.lockedPoints).toBe(8);
  });

  it("group not finalized scores nothing yet", () => {
    const r = scoreParticipant(
      emptyPicks({
        groupStanding: [
          { group: "A", position: 1, teamId: "ENG" },
          { group: "A", position: 2, teamId: "USA" },
        ],
      }),
      map(),
      emptyActuals({ groupStandings: standings("A", "ENG", "USA"), groupsFinalized: [] }),
    );
    expect(r.lockedPoints).toBe(0);
  });
});

// ---- best thirds -----------------------------------------------------------

describe("best thirds", () => {
  it("awards 5 per correct qualifier once finalized", () => {
    const r = scoreParticipant(
      emptyPicks({ bestThird: ["T1", "T2", "T3"] }),
      map(),
      emptyActuals({ bestThirds: ["T1", "T3", "X9"], bestThirdsFinalized: true }),
    );
    expect(r.lockedPoints).toBe(10);
  });

  it("not finalized = 0", () => {
    const r = scoreParticipant(
      emptyPicks({ bestThird: ["T1", "T2"] }),
      map(),
      emptyActuals({ bestThirds: ["T1", "T2"], bestThirdsFinalized: false }),
    );
    expect(r.lockedPoints).toBe(0);
  });
});

// ---- knockout set-membership ----------------------------------------------

describe("knockout advancement", () => {
  it("R16=10, QF=20, SF=40, FINAL=80 per correct survivor", () => {
    const r = scoreParticipant(
      emptyPicks({
        advance: [
          { round: "R16", teamId: "A" },
          { round: "R16", teamId: "B" }, // wrong
          { round: "QF", teamId: "A" },
          { round: "SF", teamId: "A" },
          { round: "FINAL", teamId: "A" },
        ],
      }),
      map(),
      emptyActuals({
        advance: [
          { round: "R16", teamId: "A" },
          { round: "QF", teamId: "A" },
          { round: "SF", teamId: "A" },
          { round: "FINAL", teamId: "A" },
        ],
      }),
    );
    expect(r.livePoints).toBe(10 + 20 + 40 + 80);
  });

  it("awards incrementally as the actual set grows", () => {
    const picks = emptyPicks({
      advance: [
        { round: "R16", teamId: "A" },
        { round: "R16", teamId: "B" },
      ],
    });
    const partial = scoreParticipant(
      picks,
      map(),
      emptyActuals({ advance: [{ round: "R16", teamId: "A" }] }),
    );
    expect(partial.livePoints).toBe(10);
    const full = scoreParticipant(
      picks,
      map(),
      emptyActuals({
        advance: [
          { round: "R16", teamId: "A" },
          { round: "R16", teamId: "B" },
        ],
      }),
    );
    expect(full.livePoints).toBe(20);
  });
});

// ---- final -----------------------------------------------------------------

describe("final", () => {
  it("champion 160 + runner-up 40 = 200 max", () => {
    const r = scoreParticipant(
      emptyPicks({
        final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "T" },
      }),
      map(),
      emptyActuals({
        final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "X" },
      }),
    );
    expect(r.lockedPoints).toBe(200);
  });

  it("third-place winner = 40", () => {
    const r = scoreParticipant(
      emptyPicks({
        final: { championTeamId: "X", runnerUpTeamId: "Y", thirdPlaceTeamId: "T" },
      }),
      map(),
      emptyActuals({
        final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "T" },
      }),
    );
    expect(r.lockedPoints).toBe(40);
  });
});

// ---- maxPossible & idempotency --------------------------------------------

describe("maxPossible", () => {
  it("is an upper bound >= livePoints and shrinks as results land", () => {
    const picks = emptyPicks({
      groupMatch: [{ matchId: "m1", predHome: 2, predAway: 1 }],
      final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "T" },
    });
    const before = scoreParticipant(picks, map(gm("m1", null, null, "SCHEDULED")), emptyActuals());
    // 4 (match) + 160 + 40 + 40 (final placements) all still attainable
    expect(before.maxPossible).toBe(4 + 160 + 40 + 40);
    expect(before.maxPossible).toBeGreaterThanOrEqual(before.livePoints);

    const after = scoreParticipant(
      picks,
      map(gm("m1", 2, 1)),
      emptyActuals({
        // champion + runner-up correct; third-place decided but wrong.
        final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "X" },
      }),
    );
    expect(after.lockedPoints).toBe(4 + 200);
    expect(after.maxPossible).toBe(after.lockedPoints); // everything decided
    expect(after.maxPossible).toBeLessThanOrEqual(before.maxPossible);
  });
});

describe("determinism", () => {
  it("identical inputs produce identical output", () => {
    const picks = emptyPicks({ groupMatch: [{ matchId: "m1", predHome: 1, predAway: 0 }] });
    const a = scoreParticipant(picks, map(gm("m1", 2, 0)), emptyActuals());
    const b = scoreParticipant(picks, map(gm("m1", 2, 0)), emptyActuals());
    expect(a).toEqual(b);
  });
});

describe("scoreAll ranking", () => {
  it("ranks by live points with shared ranks on ties", () => {
    const ranked = scoreAll(
      [
        emptyPicks({ participantId: "p1", groupMatch: [{ matchId: "m1", predHome: 2, predAway: 1 }] }), // 4
        emptyPicks({ participantId: "p2", groupMatch: [{ matchId: "m1", predHome: 1, predAway: 0 }] }), // 2
        emptyPicks({ participantId: "p3", groupMatch: [{ matchId: "m1", predHome: 3, predAway: 0 }] }), // 2 (result only)
      ],
      map(gm("m1", 2, 1)),
      emptyActuals(),
    );
    const byId = new Map(ranked.map((r) => [r.participantId, r]));
    expect(byId.get("p1")!.rank).toBe(1);
    expect(byId.get("p2")!.rank).toBe(2);
    expect(byId.get("p3")!.rank).toBe(2); // tie with p2
  });
});

describe("constants sanity", () => {
  it("matches the rulebook point values", () => {
    expect(POINTS.groupResult).toBe(2);
    expect(POINTS.groupExactBonus).toBe(2);
    expect(POINTS.advance).toBe(5);
    expect(POINTS.reach).toEqual({ R16: 10, QF: 20, SF: 40, FINAL: 80 });
    expect(POINTS.champion).toBe(160);
  });
});
