// Live scoring verification for the admin Scoring tab. Two independent cross-checks:
//  1. Per finished group match: re-derive each player's points with a SEPARATE
//     implementation and compare to the stored ScoreLine (catches engine/persistence bugs).
//  2. Fresh full recompute vs the stored Standing snapshot (catches stale/missing settles).
// Anything that doesn't reconcile is reported. Target: zero discrepancies.

import { prisma } from "../db";
import { deriveActuals } from "./derive";
import type { DbMatch } from "./derive";
import { scoreAll } from "./engine";
import type { AdvanceRound, MatchResult, ParticipantPicks } from "./types";

// A deliberately separate implementation of group-match scoring (does NOT call
// the engine), so a bug in one is caught by disagreeing with the other.
export function independentGroupPoints(
  predH: number,
  predA: number,
  actH: number,
  actA: number,
): number {
  const sign = (a: number, b: number) => (a > b ? 1 : a < b ? -1 : 0);
  let pts = 0;
  if (sign(predH, predA) === sign(actH, actA)) {
    pts += 2; // correct winner/draw
    if (predH === actH && predA === actA) pts += 2; // exact bonus
  }
  return pts;
}

export type MatchCheck = {
  matchId: string;
  label: string;
  group: string | null;
  players: number;
  discrepancies: { name: string; expected: number; stored: number }[];
};

export async function verifyScoring() {
  const [matchesRaw, participants, storedLines, storedStandings, appState] = await Promise.all([
    prisma.match.findMany({
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
    prisma.participant.findMany({
      include: {
        groupMatchPicks: true,
        groupStandingPicks: true,
        bestThirdPicks: true,
        advancePicks: true,
        finalPick: true,
        standing: true,
      },
    }),
    prisma.scoreLine.findMany({ where: { category: "GROUP_MATCH" } }),
    prisma.standing.findMany(),
    prisma.appState.findUnique({ where: { id: 1 } }),
  ]);

  const nameById = new Map(participants.map((p) => [p.id, p.name]));

  // --- check 1: per finished group match, independent vs stored -------------
  const storedByKey = new Map<string, number>(); // `${participant}:${match}` -> points
  for (const l of storedLines) {
    if (l.matchId) storedByKey.set(`${l.participantId}:${l.matchId}`, (storedByKey.get(`${l.participantId}:${l.matchId}`) ?? 0) + l.points);
  }

  const finishedGroup = matchesRaw.filter(
    (m) => m.stage === "GROUP" && m.status === "FINISHED" && m.homeScore != null && m.awayScore != null,
  );
  const matchChecks: MatchCheck[] = [];
  let matchDiscrepancies = 0;
  for (const m of finishedGroup) {
    const picks = participants.flatMap((p) =>
      p.groupMatchPicks.filter((gp) => gp.matchId === m.id).map((gp) => ({ pid: p.id, gp })),
    );
    const discrepancies: MatchCheck["discrepancies"] = [];
    for (const { pid, gp } of picks) {
      const expected = independentGroupPoints(gp.predHome, gp.predAway, m.homeScore!, m.awayScore!);
      const stored = storedByKey.get(`${pid}:${m.id}`) ?? 0;
      if (expected !== stored) {
        discrepancies.push({ name: nameById.get(pid) ?? pid, expected, stored });
        matchDiscrepancies++;
      }
    }
    matchChecks.push({
      matchId: m.id,
      label: `${m.homeTeam?.name ?? "?"} ${m.homeScore}–${m.awayScore} ${m.awayTeam?.name ?? "?"}`,
      group: m.group,
      players: picks.length,
      discrepancies,
    });
  }

  // --- check 2: fresh full recompute vs stored standings --------------------
  const matches: DbMatch[] = matchesRaw.map((m) => ({
    id: m.id, stage: m.stage, group: m.group, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
    homeScore: m.homeScore, awayScore: m.awayScore, winnerTeamId: m.winnerTeamId, status: m.status,
  }));
  const actuals = deriveActuals(matches);
  const matchesById = new Map<string, MatchResult>(
    matches.map((m) => [m.id, {
      id: m.id, stage: m.stage as MatchResult["stage"], group: m.group,
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeScore: m.homeScore, awayScore: m.awayScore,
      status: m.status as MatchResult["status"],
    }]),
  );
  const picks: ParticipantPicks[] = participants.map((p) => ({
    participantId: p.id,
    groupMatch: p.groupMatchPicks.map((g) => ({ matchId: g.matchId, predHome: g.predHome, predAway: g.predAway })),
    groupStanding: p.groupStandingPicks.map((g) => ({ group: g.group, position: g.position, teamId: g.teamId })),
    bestThird: p.bestThirdPicks.map((b) => b.teamId),
    advance: p.advancePicks.map((a) => ({ round: a.round as AdvanceRound, teamId: a.teamId })),
    final: p.finalPick
      ? { championTeamId: p.finalPick.championTeamId, runnerUpTeamId: p.finalPick.runnerUpTeamId, thirdPlaceTeamId: p.finalPick.thirdPlaceTeamId }
      : null,
  }));
  const fresh = scoreAll(picks, matchesById, actuals);
  const storedTotal = new Map(storedStandings.map((s) => [s.participantId, s.totalPoints]));

  const standingDiscrepancies: { name: string; fresh: number; stored: number }[] = [];
  for (const f of fresh) {
    const stored = storedTotal.get(f.participantId);
    if (stored == null || stored !== f.lockedPoints) {
      standingDiscrepancies.push({ name: nameById.get(f.participantId) ?? f.participantId, fresh: f.lockedPoints, stored: stored ?? 0 });
    }
  }

  return {
    matchChecks,
    matchesChecked: finishedGroup.length,
    matchDiscrepancies,
    standingDiscrepancies,
    participants: participants.length,
    lastSettledAt: appState?.lastSettledAt ?? null,
    allGood: matchDiscrepancies === 0 && standingDiscrepancies.length === 0,
  };
}
