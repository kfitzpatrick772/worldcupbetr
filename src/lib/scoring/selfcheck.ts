// Runtime "evals": replay the league rulebook's worked examples (and edge cases)
// through the live scoring engine and report pass/fail. Pure — runs in prod, no
// test runner. Powers the admin Scoring tab so correctness is provable anytime,
// including BEFORE the tournament starts.

import { scoreParticipant } from "./engine";
import type { Actuals, MatchResult, ParticipantPicks } from "./types";

function A(over: Partial<Actuals> = {}): Actuals {
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
function P(over: Partial<ParticipantPicks> = {}): ParticipantPicks {
  return { participantId: "x", groupMatch: [], groupStanding: [], bestThird: [], advance: [], final: null, ...over };
}
function gm(id: string, hs: number, as_: number, status: MatchResult["status"] = "FINISHED"): MatchResult {
  return { id, stage: "GROUP", group: "A", homeTeamId: "H", awayTeamId: "AW", homeScore: hs, awayScore: as_, status };
}
const M = (...ms: MatchResult[]) => new Map(ms.map((m) => [m.id, m]));

export type Check = {
  name: string;
  rule: string;
  expected: number;
  got: number;
  pass: boolean;
};

export function runSelfCheck(): { checks: Check[]; passed: number; total: number } {
  const checks: Check[] = [];
  const add = (name: string, rule: string, expected: number, got: number) =>
    checks.push({ name, rule, expected, got, pass: got === expected });

  // --- group match results ---
  add("Correct winner", "Correct winner/draw = 2", 2,
    scoreParticipant(P({ groupMatch: [{ matchId: "m", predHome: 1, predAway: 0 }] }), M(gm("m", 3, 0)), A()).lockedPoints);
  add("Exact scoreline (2-1)", "Correct scoreline = +2 bonus (4 total)", 4,
    scoreParticipant(P({ groupMatch: [{ matchId: "m", predHome: 2, predAway: 1 }] }), M(gm("m", 2, 1)), A()).lockedPoints);
  add("Predicted draw, ends draw", "Correct draw = 2", 2,
    scoreParticipant(P({ groupMatch: [{ matchId: "m", predHome: 0, predAway: 0 }] }), M(gm("m", 1, 1)), A()).lockedPoints);
  add("Wrong result", "Wrong = 0", 0,
    scoreParticipant(P({ groupMatch: [{ matchId: "m", predHome: 2, predAway: 0 }] }), M(gm("m", 0, 1)), A()).lockedPoints);

  // --- group advancement ---
  const stand = (g: string, a: string, b: string) => [
    { group: g, position: 1, teamId: a },
    { group: g, position: 2, teamId: b },
  ];
  add("Group: both right, exact slots", "advance 5+5, winner +3, runner-up +2 = 15", 15,
    scoreParticipant(
      P({ groupStanding: [{ group: "A", position: 1, teamId: "ENG" }, { group: "A", position: 2, teamId: "USA" }] }),
      M(), A({ groupStandings: stand("A", "ENG", "USA"), groupsFinalized: ["A"] })).lockedPoints);
  add("Group: top-2 right, slots swapped", "advance 5+5, no bonuses = 10", 10,
    scoreParticipant(
      P({ groupStanding: [{ group: "A", position: 1, teamId: "USA" }, { group: "A", position: 2, teamId: "ENG" }] }),
      M(), A({ groupStandings: stand("A", "ENG", "USA"), groupsFinalized: ["A"] })).lockedPoints);
  add("Group: same team both slots (invalid)", "advance counted once (5+3) = 8", 8,
    scoreParticipant(
      P({ groupStanding: [{ group: "A", position: 1, teamId: "ENG" }, { group: "A", position: 2, teamId: "ENG" }] }),
      M(), A({ groupStandings: stand("A", "ENG", "USA"), groupsFinalized: ["A"] })).lockedPoints);

  // --- best thirds ---
  add("Best thirds", "5 per correct qualifier (2 correct = 10)", 10,
    scoreParticipant(P({ bestThird: ["T1", "T2", "T3"] }), M(),
      A({ bestThirds: ["T1", "T3", "Z"], bestThirdsFinalized: true })).lockedPoints);

  // --- knockout set-membership ---
  add("Reach R16 (won R32)", "10 per advancing team", 10,
    scoreParticipant(P({ advance: [{ round: "R16", teamId: "A" }] }), M(), A({ advance: [{ round: "R16", teamId: "A" }] })).livePoints);
  add("Reach QF", "20 per advancing team", 20,
    scoreParticipant(P({ advance: [{ round: "QF", teamId: "A" }] }), M(), A({ advance: [{ round: "QF", teamId: "A" }] })).livePoints);
  add("Reach SF", "40 per advancing team", 40,
    scoreParticipant(P({ advance: [{ round: "SF", teamId: "A" }] }), M(), A({ advance: [{ round: "SF", teamId: "A" }] })).livePoints);
  add("Reach Final", "80 per advancing team", 80,
    scoreParticipant(P({ advance: [{ round: "FINAL", teamId: "A" }] }), M(), A({ advance: [{ round: "FINAL", teamId: "A" }] })).livePoints);

  // --- final ---
  add("Champion + runner-up", "champion 160 + runner-up 40 = 200", 200,
    scoreParticipant(P({ final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "T" } }), M(),
      A({ final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "X" } })).lockedPoints);
  add("Third-place match winner", "3rd-place winner = 40", 40,
    scoreParticipant(P({ final: { championTeamId: "x", runnerUpTeamId: "y", thirdPlaceTeamId: "T" } }), M(),
      A({ final: { championTeamId: "C", runnerUpTeamId: "R", thirdPlaceTeamId: "T" } })).lockedPoints);

  return { checks, passed: checks.filter((c) => c.pass).length, total: checks.length };
}
