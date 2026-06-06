// Deterministic, idempotent scoring engine.
//
// Pure function of (locked picks, stored actuals). Re-running on the same inputs
// always yields the same output. The serve/admin layers translate DB rows into
// these plain types and persist the result; the engine itself never touches I/O.

import type {
  Actuals,
  AdvanceRound,
  MatchResult,
  Outcome,
  ParticipantPicks,
  ParticipantScore,
  ScoreCategory,
  ScoreLineOut,
} from "./types";

export const POINTS = {
  groupResult: 2, // correct winner/draw
  groupExactBonus: 2, // correct exact scoreline (on top of result)
  advance: 5, // team finishes top-2 of its group
  groupWinnerBonus: 3, // correct group winner (your #1 == actual #1)
  groupRunnerUpBonus: 2, // correct runner-up (your #2 == actual #2)
  bestThird: 5, // correct best-third qualifier
  reach: { R16: 10, QF: 20, SF: 40, FINAL: 80 } as Record<AdvanceRound, number>,
  champion: 160,
  runnerUp: 40,
  thirdPlace: 40,
} as const;

const ROUND_CATEGORY: Record<AdvanceRound, ScoreCategory> = {
  R16: "ADVANCE_R16",
  QF: "ADVANCE_QF",
  SF: "ADVANCE_SF",
  FINAL: "ADVANCE_FINAL",
};

export function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "DRAW";
}

/** Score a single participant. Pure. */
export function scoreParticipant(
  picks: ParticipantPicks,
  matchesById: Map<string, MatchResult>,
  actuals: Actuals,
): ParticipantScore {
  const lines: ScoreLineOut[] = [];

  // ---- 1. Group-stage match results ---------------------------------------
  for (const p of picks.groupMatch) {
    const m = matchesById.get(p.matchId);
    if (!m) continue;
    if (m.status === "SCHEDULED") continue;
    if (m.homeScore == null || m.awayScore == null) continue;

    const provisional = m.status === "LIVE";
    const actual = outcomeOf(m.homeScore, m.awayScore);
    const predicted = outcomeOf(p.predHome, p.predAway);
    let pts = 0;
    let detail = "Wrong result";
    if (actual === predicted) {
      pts += POINTS.groupResult;
      detail = "Correct result";
      if (p.predHome === m.homeScore && p.predAway === m.awayScore) {
        pts += POINTS.groupExactBonus;
        detail = "Exact scoreline";
      }
    }
    if (pts > 0) {
      lines.push({
        category: "GROUP_MATCH",
        points: pts,
        matchId: m.id,
        group: m.group ?? undefined,
        detail,
        provisional,
      });
    }
  }

  // ---- 2. Group advancement (top-2 + winner/runner-up bonuses) -------------
  const actualByGroupPos = new Map<string, string>(); // `${group}:${pos}` -> teamId
  for (const s of actuals.groupStandings) {
    actualByGroupPos.set(`${s.group}:${s.position}`, s.teamId);
  }
  for (const group of actuals.groupsFinalized) {
    const actual1 = actualByGroupPos.get(`${group}:1`);
    const actual2 = actualByGroupPos.get(`${group}:2`);
    const actualTop2 = new Set([actual1, actual2].filter(Boolean) as string[]);

    const myPicks = picks.groupStanding.filter((g) => g.group === group);
    // Award advancement once per DISTINCT picked team — a team can only advance
    // once even if (invalidly) entered in both slots.
    for (const teamId of new Set(myPicks.map((p) => p.teamId))) {
      if (actualTop2.has(teamId)) {
        lines.push({
          category: "GROUP_ADVANCE",
          points: POINTS.advance,
          teamId,
          group,
          detail: `Advanced from Group ${group}`,
        });
      }
    }
    const my1 = myPicks.find((g) => g.position === 1)?.teamId;
    const my2 = myPicks.find((g) => g.position === 2)?.teamId;
    if (my1 && actual1 && my1 === actual1) {
      lines.push({
        category: "GROUP_WINNER_BONUS",
        points: POINTS.groupWinnerBonus,
        teamId: my1,
        group,
        detail: `Correct winner of Group ${group}`,
      });
    }
    if (my2 && actual2 && my2 === actual2) {
      lines.push({
        category: "GROUP_RUNNERUP_BONUS",
        points: POINTS.groupRunnerUpBonus,
        teamId: my2,
        group,
        detail: `Correct runner-up of Group ${group}`,
      });
    }
  }

  // ---- 3. Best third-place qualifiers -------------------------------------
  if (actuals.bestThirdsFinalized) {
    const actualThirds = new Set(actuals.bestThirds);
    for (const teamId of new Set(picks.bestThird)) {
      if (actualThirds.has(teamId)) {
        lines.push({
          category: "BEST_THIRD",
          points: POINTS.bestThird,
          teamId,
          detail: "Correct best-third qualifier",
        });
      }
    }
  }

  // ---- 4. Knockout advancement (set membership) ---------------------------
  // Awarded incrementally: a team's points land as soon as it appears in the
  // actual advancer set for that round (i.e., its prior-round match finished).
  const actualAdvance = new Map<AdvanceRound, Set<string>>();
  for (const a of actuals.advance) {
    if (!actualAdvance.has(a.round)) actualAdvance.set(a.round, new Set());
    actualAdvance.get(a.round)!.add(a.teamId);
  }
  const seenAdvance = new Set<string>();
  for (const pick of picks.advance) {
    const key = `${pick.round}:${pick.teamId}`;
    if (seenAdvance.has(key)) continue; // dedup defensively
    seenAdvance.add(key);
    const set = actualAdvance.get(pick.round);
    if (set && set.has(pick.teamId)) {
      lines.push({
        category: ROUND_CATEGORY[pick.round],
        points: POINTS.reach[pick.round],
        teamId: pick.teamId,
        detail: `Reached ${roundLabel(pick.round)}`,
      });
    }
  }

  // ---- 5. Final: champion / runner-up / third-place winner ----------------
  if (picks.final) {
    if (
      actuals.final.championTeamId &&
      picks.final.championTeamId === actuals.final.championTeamId
    ) {
      lines.push({
        category: "CHAMPION",
        points: POINTS.champion,
        teamId: picks.final.championTeamId,
        detail: "Correct World Cup champion",
      });
    }
    if (
      actuals.final.runnerUpTeamId &&
      picks.final.runnerUpTeamId === actuals.final.runnerUpTeamId
    ) {
      lines.push({
        category: "RUNNERUP",
        points: POINTS.runnerUp,
        teamId: picks.final.runnerUpTeamId,
        detail: "Correct runner-up",
      });
    }
    if (
      actuals.final.thirdPlaceTeamId &&
      picks.final.thirdPlaceTeamId === actuals.final.thirdPlaceTeamId
    ) {
      lines.push({
        category: "THIRD_PLACE",
        points: POINTS.thirdPlace,
        teamId: picks.final.thirdPlaceTeamId,
        detail: "Correct third-place winner",
      });
    }
  }

  const livePoints = lines.reduce((s, l) => s + l.points, 0);
  const lockedPoints = lines.reduce(
    (s, l) => s + (l.provisional ? 0 : l.points),
    0,
  );
  const maxPossible =
    lockedPoints + remainingCeiling(picks, matchesById, actuals, lines);

  return { participantId: picks.participantId, lines, lockedPoints, livePoints, maxPossible };
}

/**
 * Safe upper bound on additional points still attainable. Always an over- or
 * exact estimate (never under), so it can be used to detect elimination without
 * ever eliminating someone prematurely.
 */
function remainingCeiling(
  picks: ParticipantPicks,
  matchesById: Map<string, MatchResult>,
  actuals: Actuals,
  lines: ScoreLineOut[],
): number {
  let ceil = 0;

  // Group matches not yet final: up to 4 each.
  for (const p of picks.groupMatch) {
    const m = matchesById.get(p.matchId);
    if (!m || m.status !== "FINISHED") {
      ceil += POINTS.groupResult + POINTS.groupExactBonus;
    }
  }

  // Groups not finalized: up to 15 each (5 + 5 + 3 + 2) for someone who picked.
  const finalizedGroups = new Set(actuals.groupsFinalized);
  const pickedGroups = new Set(picks.groupStanding.map((g) => g.group));
  for (const g of pickedGroups) {
    if (!finalizedGroups.has(g)) {
      ceil += 2 * POINTS.advance + POINTS.groupWinnerBonus + POINTS.groupRunnerUpBonus;
    }
  }

  // Best thirds not finalized: up to 5 per distinct pick.
  if (!actuals.bestThirdsFinalized) {
    ceil += new Set(picks.bestThird).size * POINTS.bestThird;
  }

  // Knockout rounds not finalized: up to roundValue per pick not yet awarded.
  const finalizedRounds = new Set(actuals.advanceFinalized);
  const awardedByRound = new Map<AdvanceRound, number>();
  for (const l of lines) {
    const r = categoryRound(l.category);
    if (r) awardedByRound.set(r, (awardedByRound.get(r) ?? 0) + 1);
  }
  const picksByRound = new Map<AdvanceRound, number>();
  const seenRoundTeam = new Set<string>();
  for (const p of picks.advance) {
    const key = `${p.round}:${p.teamId}`;
    if (seenRoundTeam.has(key)) continue;
    seenRoundTeam.add(key);
    picksByRound.set(p.round, (picksByRound.get(p.round) ?? 0) + 1);
  }
  for (const round of ["R16", "QF", "SF", "FINAL"] as AdvanceRound[]) {
    if (finalizedRounds.has(round)) continue;
    const total = picksByRound.get(round) ?? 0;
    const awarded = awardedByRound.get(round) ?? 0;
    ceil += Math.max(0, total - awarded) * POINTS.reach[round];
  }

  // Final placements not yet decided.
  if (picks.final) {
    if (!actuals.final.championTeamId) ceil += POINTS.champion;
    if (!actuals.final.runnerUpTeamId) ceil += POINTS.runnerUp;
    if (!actuals.final.thirdPlaceTeamId) ceil += POINTS.thirdPlace;
  }

  return ceil;
}

function categoryRound(c: ScoreCategory): AdvanceRound | null {
  switch (c) {
    case "ADVANCE_R16":
      return "R16";
    case "ADVANCE_QF":
      return "QF";
    case "ADVANCE_SF":
      return "SF";
    case "ADVANCE_FINAL":
      return "FINAL";
    default:
      return null;
  }
}

function roundLabel(r: AdvanceRound): string {
  return { R16: "Round of 16", QF: "Quarter-finals", SF: "Semi-finals", FINAL: "the Final" }[r];
}

/** Score everyone and assign ranks (live-inclusive, ties share a rank). */
export function scoreAll(
  participants: ParticipantPicks[],
  matchesById: Map<string, MatchResult>,
  actuals: Actuals,
): (ParticipantScore & { rank: number })[] {
  const scored = participants.map((p) =>
    scoreParticipant(p, matchesById, actuals),
  );
  const sorted = [...scored].sort((a, b) => b.livePoints - a.livePoints);
  const ranked = new Map<string, number>();
  let lastPoints: number | null = null;
  let lastRank = 0;
  sorted.forEach((s, i) => {
    const rank = lastPoints === s.livePoints ? lastRank : i + 1;
    ranked.set(s.participantId, rank);
    lastPoints = s.livePoints;
    lastRank = rank;
  });
  return scored.map((s) => ({ ...s, rank: ranked.get(s.participantId)! }));
}
