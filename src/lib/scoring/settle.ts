// Settlement orchestrator (the "Settle" stage).
//
// Reads match results + locked picks from the DB, derives actuals (pure, in
// derive.ts), runs the pure scoring engine, and writes ScoreLine rows + the
// Standing snapshot in one transaction. Idempotent. Called by the admin
// (manual result entry / re-settle) and the live feed.

import { prisma } from "../db";
import { deriveActuals, unresolvedKnockouts } from "./derive";
import type { DbMatch } from "./derive";
import { scoreAll } from "./engine";
import type { MatchResult, ParticipantPicks, AdvanceRound } from "./types";

async function loadParticipantPicks(): Promise<ParticipantPicks[]> {
  const participants = await prisma.participant.findMany({
    include: {
      groupMatchPicks: true,
      groupStandingPicks: true,
      bestThirdPicks: true,
      advancePicks: true,
      finalPick: true,
    },
  });
  return participants.map((p) => ({
    participantId: p.id,
    groupMatch: p.groupMatchPicks.map((g) => ({
      matchId: g.matchId,
      predHome: g.predHome,
      predAway: g.predAway,
    })),
    groupStanding: p.groupStandingPicks.map((g) => ({
      group: g.group,
      position: g.position,
      teamId: g.teamId,
    })),
    bestThird: p.bestThirdPicks.map((b) => b.teamId),
    advance: p.advancePicks.map((a) => ({ round: a.round as AdvanceRound, teamId: a.teamId })),
    final: p.finalPick
      ? {
          championTeamId: p.finalPick.championTeamId,
          runnerUpTeamId: p.finalPick.runnerUpTeamId,
          thirdPlaceTeamId: p.finalPick.thirdPlaceTeamId,
        }
      : null,
  }));
}

/** Recompute and persist all scores + the leaderboard snapshot. */
export async function settle(trigger = "manual") {
  const run = await prisma.settlementRun.create({ data: { trigger } });

  const [matchesRaw, picks] = await Promise.all([
    prisma.match.findMany(),
    loadParticipantPicks(),
  ]);

  const matches: DbMatch[] = matchesRaw.map((m) => ({
    id: m.id,
    stage: m.stage,
    group: m.group,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    winnerTeamId: m.winnerTeamId,
    status: m.status,
  }));
  const actuals = deriveActuals(matches);
  const warnings = unresolvedKnockouts(matches).map((m) => m.id);

  const matchesById = new Map<string, MatchResult>(
    matches.map((m) => [
      m.id,
      {
        id: m.id,
        stage: m.stage as MatchResult["stage"],
        group: m.group,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status as MatchResult["status"],
      },
    ]),
  );

  const scored = scoreAll(picks, matchesById, actuals);

  const prev = new Map(
    (await prisma.standing.findMany({ select: { participantId: true, rank: true } })).map(
      (s) => [s.participantId, s.rank],
    ),
  );

  await prisma.$transaction(async (tx) => {
    // Rewrite derived actuals (visibility; admin override comes in Phase 3).
    await tx.groupStandingActual.deleteMany({});
    if (actuals.groupStandings.length)
      await tx.groupStandingActual.createMany({ data: actuals.groupStandings });
    await tx.bestThirdActual.deleteMany({});
    if (actuals.bestThirds.length)
      await tx.bestThirdActual.createMany({ data: actuals.bestThirds.map((teamId) => ({ teamId })) });
    await tx.advanceActual.deleteMany({});
    if (actuals.advance.length) await tx.advanceActual.createMany({ data: actuals.advance });
    await tx.finalActual.upsert({
      where: { id: 1 },
      create: { id: 1, ...actuals.final },
      update: { ...actuals.final },
    });

    // Rewrite scores. Provisional lines (from LIVE matches) are NOT persisted:
    // points reach the board only once a match is finished.
    await tx.scoreLine.deleteMany({});
    const lineData = scored.flatMap((s) =>
      s.lines.filter((l) => !l.provisional).map((l) => ({
        participantId: s.participantId,
        category: l.category,
        points: l.points,
        matchId: l.matchId ?? null,
        teamId: l.teamId ?? null,
        group: l.group ?? null,
        detail: l.detail ?? null,
      })),
    );
    if (lineData.length) await tx.scoreLine.createMany({ data: lineData });

    // Rewrite standings snapshot.
    for (const s of scored) {
      await tx.standing.upsert({
        where: { participantId: s.participantId },
        create: {
          participantId: s.participantId,
          totalPoints: s.lockedPoints,
          rank: s.rank,
          prevRank: prev.get(s.participantId) ?? null,
          maxPossible: s.maxPossible,
        },
        update: {
          totalPoints: s.lockedPoints,
          rank: s.rank,
          prevRank: prev.get(s.participantId) ?? s.rank,
          maxPossible: s.maxPossible,
        },
      });
    }

    await tx.appState.upsert({
      where: { id: 1 },
      create: { id: 1, lastSettledAt: new Date() },
      update: { lastSettledAt: new Date() },
    });
    await tx.settlementRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        summary: {
          participants: scored.length,
          scoreLines: lineData.length,
          groupsFinalized: actuals.groupsFinalized.length,
          bestThirdsFinalized: actuals.bestThirdsFinalized,
          unresolvedKnockouts: warnings,
        },
      },
    });
  });

  return {
    participants: scored.length,
    lines: scored.reduce((n, s) => n + s.lines.length, 0),
    warnings,
  };
}
