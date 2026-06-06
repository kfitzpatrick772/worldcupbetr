// Settlement orchestrator (the "Settle" stage).
//
// Reads match results + locked picks from the DB, DERIVES the actuals
// (group tables, best-thirds, knockout survivors, final), runs the pure scoring
// engine, and writes ScoreLine rows + the Standing snapshot in one transaction.
// Idempotent: running it repeatedly on the same data yields the same result.
//
// Called by the admin (manual result entry / re-settle) and the live feed.

import { prisma } from "../db";
import { scoreAll } from "./engine";
import { buildTable, computeBestThirds, computeGroupOrder } from "./standings";
import type { FinishedMatch } from "./standings";
import type {
  Actuals,
  AdvanceRound,
  MatchResult,
  ParticipantPicks,
} from "./types";

type DbMatch = {
  id: string;
  stage: string;
  group: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  status: string;
};

const STAGE_TO_REACHED: Record<string, AdvanceRound | undefined> = {
  R32: "R16", // win R32 => reach R16
  R16: "QF",
  QF: "SF",
  SF: "FINAL",
};

// Total matches per knockout stage — a round is "finalized" once all are done.
const STAGE_MATCH_COUNT: Record<string, number> = { R32: 16, R16: 8, QF: 4, SF: 2 };

function winnerLoser(m: DbMatch): { winner: string | null; loser: string | null } {
  if (m.status !== "FINISHED") return { winner: null, loser: null };
  if (m.winnerTeamId) {
    const loser =
      m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    return { winner: m.winnerTeamId, loser };
  }
  if (m.homeScore != null && m.awayScore != null && m.homeScore !== m.awayScore) {
    return m.homeScore > m.awayScore
      ? { winner: m.homeTeamId, loser: m.awayTeamId }
      : { winner: m.awayTeamId, loser: m.homeTeamId };
  }
  return { winner: null, loser: null }; // knockout draw needs winnerTeamId
}

/** Derive the canonical Actuals from match results. Pure given the match list. */
export function deriveActuals(matches: DbMatch[]): Actuals {
  const groupStandings: Actuals["groupStandings"] = [];
  const groupsFinalized: string[] = [];

  // Group tables.
  const groups = [...new Set(matches.filter((m) => m.stage === "GROUP" && m.group).map((m) => m.group!))];
  const thirdsStats: { teamId: string; points: number; gd: number; gf: number; ga: number; played: number; won: number; drawn: number; lost: number }[] = [];

  for (const g of groups.sort()) {
    const gm = matches.filter((m) => m.stage === "GROUP" && m.group === g);
    const teamIds = [...new Set(gm.flatMap((m) => [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[]))];
    const finished = gm.filter((m) => m.status === "FINISHED" && m.homeScore != null && m.awayScore != null);
    const allDone = gm.length > 0 && finished.length === gm.length;
    if (!allDone) continue;

    const fms: FinishedMatch[] = finished.map((m) => ({
      homeTeamId: m.homeTeamId!,
      awayTeamId: m.awayTeamId!,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
    }));
    const order = computeGroupOrder(teamIds, fms);
    order.forEach((teamId, i) => groupStandings.push({ group: g, position: i + 1, teamId }));
    groupsFinalized.push(g);
  }

  // Best thirds — only once every group is finalized.
  let bestThirds: string[] = [];
  let bestThirdsFinalized = false;
  if (groupsFinalized.length === groups.length && groups.length > 0) {
    // Recompute each group's table to get the 3rd-placed team's full stats.
    for (const g of groupsFinalized) {
      const gm = matches.filter((m) => m.stage === "GROUP" && m.group === g);
      const teamIds = [...new Set(gm.flatMap((m) => [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[]))];
      const fms: FinishedMatch[] = gm.map((m) => ({
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        homeScore: m.homeScore!,
        awayScore: m.awayScore!,
      }));
      const order = computeGroupOrder(teamIds, fms);
      const thirdId = order[2];
      const stat = buildTable(teamIds, fms).get(thirdId)!;
      thirdsStats.push(stat);
    }
    bestThirds = computeBestThirds(thirdsStats);
    bestThirdsFinalized = true;
  }

  // Knockout survivors.
  const advance: Actuals["advance"] = [];
  const advanceFinalized: AdvanceRound[] = [];
  for (const stage of ["R32", "R16", "QF", "SF"]) {
    const reached = STAGE_TO_REACHED[stage]!;
    const sm = matches.filter((m) => m.stage === stage);
    for (const m of sm) {
      const { winner } = winnerLoser(m);
      if (winner) advance.push({ round: reached, teamId: winner });
    }
    const done = sm.filter((m) => m.status === "FINISHED").length;
    if (STAGE_MATCH_COUNT[stage] && done === STAGE_MATCH_COUNT[stage]) {
      advanceFinalized.push(reached);
    }
  }

  // Final + third-place match.
  const finalMatch = matches.find((m) => m.stage === "FINAL");
  const thirdMatch = matches.find((m) => m.stage === "THIRD");
  const fin = finalMatch ? winnerLoser(finalMatch) : { winner: null, loser: null };
  const third = thirdMatch ? winnerLoser(thirdMatch) : { winner: null, loser: null };

  return {
    groupStandings,
    groupsFinalized,
    bestThirds,
    bestThirdsFinalized,
    advance,
    advanceFinalized,
    final: {
      championTeamId: fin.winner,
      runnerUpTeamId: fin.loser,
      thirdPlaceTeamId: third.winner,
    },
  };
}

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

  // Previous ranks (for movement arrows).
  const prev = new Map(
    (await prisma.standing.findMany({ select: { participantId: true, rank: true } })).map(
      (s) => [s.participantId, s.rank],
    ),
  );

  await prisma.$transaction(async (tx) => {
    // Rewrite derived actuals (auto-derived; admin override comes in Phase 3).
    await tx.groupStandingActual.deleteMany({});
    if (actuals.groupStandings.length)
      await tx.groupStandingActual.createMany({ data: actuals.groupStandings });
    await tx.bestThirdActual.deleteMany({});
    if (actuals.bestThirds.length)
      await tx.bestThirdActual.createMany({ data: actuals.bestThirds.map((teamId) => ({ teamId })) });
    await tx.advanceActual.deleteMany({});
    if (actuals.advance.length)
      await tx.advanceActual.createMany({ data: actuals.advance });
    await tx.finalActual.upsert({
      where: { id: 1 },
      create: { id: 1, ...actuals.final },
      update: { ...actuals.final },
    });

    // Rewrite scores.
    await tx.scoreLine.deleteMany({});
    const lineData = scored.flatMap((s) =>
      s.lines.map((l) => ({
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
          totalPoints: s.livePoints,
          rank: s.rank,
          prevRank: prev.get(s.participantId) ?? null,
          maxPossible: s.maxPossible,
        },
        update: {
          totalPoints: s.livePoints,
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
        },
      },
    });
  });

  return { participants: scored.length, lines: scored.reduce((n, s) => n + s.lines.length, 0) };
}
