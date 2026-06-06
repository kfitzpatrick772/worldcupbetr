// Pure derivation of canonical Actuals from match results — NO database import,
// so it is unit-testable in isolation (this is the highest-risk logic).
// settle.ts wraps this with DB I/O.

import { buildTable, computeBestThirds, computeGroupOrder } from "./standings";
import type { FinishedMatch } from "./standings";
import type { Actuals, AdvanceRound } from "./types";

export type DbMatch = {
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

export const STAGE_TO_REACHED: Record<string, AdvanceRound | undefined> = {
  R32: "R16", // win R32 => reach R16
  R16: "QF",
  QF: "SF",
  SF: "FINAL",
};

// Total matches per knockout stage — a round is "finalized" once all are RESOLVED.
export const STAGE_MATCH_COUNT: Record<string, number> = { R32: 16, R16: 8, QF: 4, SF: 2 };

export function winnerLoser(m: DbMatch): { winner: string | null; loser: string | null } {
  if (m.status !== "FINISHED") return { winner: null, loser: null };
  if (m.winnerTeamId) {
    const loser = m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    return { winner: m.winnerTeamId, loser };
  }
  if (m.homeScore != null && m.awayScore != null && m.homeScore !== m.awayScore) {
    return m.homeScore > m.awayScore
      ? { winner: m.homeTeamId, loser: m.awayTeamId }
      : { winner: m.awayTeamId, loser: m.homeTeamId };
  }
  return { winner: null, loser: null }; // knockout decided on penalties needs winnerTeamId
}

/** Knockout matches that are FINISHED but have no resolvable winner (data error). */
export function unresolvedKnockouts(matches: DbMatch[]): DbMatch[] {
  return matches.filter(
    (m) =>
      m.stage !== "GROUP" &&
      m.status === "FINISHED" &&
      !winnerLoser(m).winner,
  );
}

/** Derive the canonical Actuals from match results. Pure given the match list. */
export function deriveActuals(matches: DbMatch[]): Actuals {
  const groupStandings: Actuals["groupStandings"] = [];
  const groupsFinalized: string[] = [];

  const groups = [
    ...new Set(matches.filter((m) => m.stage === "GROUP" && m.group).map((m) => m.group!)),
  ].sort();

  for (const g of groups) {
    const gm = matches.filter((m) => m.stage === "GROUP" && m.group === g);
    const teamIds = [
      ...new Set(gm.flatMap((m) => [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[])),
    ];
    const finished = gm.filter(
      (m) => m.status === "FINISHED" && m.homeScore != null && m.awayScore != null,
    );
    if (gm.length === 0 || finished.length !== gm.length) continue; // group not complete

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

  // Best thirds — only once EVERY group is finalized.
  let bestThirds: string[] = [];
  let bestThirdsFinalized = false;
  if (groups.length > 0 && groupsFinalized.length === groups.length) {
    const thirdsStats = [];
    for (const g of groupsFinalized) {
      const gm = matches.filter((m) => m.stage === "GROUP" && m.group === g);
      const teamIds = [
        ...new Set(gm.flatMap((m) => [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[])),
      ];
      const fms: FinishedMatch[] = gm.map((m) => ({
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        homeScore: m.homeScore!,
        awayScore: m.awayScore!,
      }));
      const order = computeGroupOrder(teamIds, fms);
      thirdsStats.push(buildTable(teamIds, fms).get(order[2])!);
    }
    bestThirds = computeBestThirds(thirdsStats);
    bestThirdsFinalized = true;
  }

  // Knockout survivors. A round is finalized only when ALL its matches RESOLVE to
  // a winner — a FINISHED-without-winner match leaves the round open (so the
  // points opportunity stays in maxPossible) until the admin sets the winner.
  const advance: Actuals["advance"] = [];
  const advanceFinalized: AdvanceRound[] = [];
  for (const stage of ["R32", "R16", "QF", "SF"]) {
    const reached = STAGE_TO_REACHED[stage]!;
    const sm = matches.filter((m) => m.stage === stage);
    let resolved = 0;
    for (const m of sm) {
      const { winner } = winnerLoser(m);
      if (winner) {
        advance.push({ round: reached, teamId: winner });
        resolved++;
      }
    }
    if (STAGE_MATCH_COUNT[stage] && resolved === STAGE_MATCH_COUNT[stage]) {
      advanceFinalized.push(reached);
    }
  }

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
