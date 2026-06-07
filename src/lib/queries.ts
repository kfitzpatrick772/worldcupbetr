// Read layer for the public board. The serve path only reads pre-computed
// snapshot rows (Standing, ScoreLine) + reference data — it never recomputes
// scores or calls the score API.
import { prisma } from "./db";
import { buildTable, computeGroupOrder } from "./scoring/standings";
import type { FinishedMatch } from "./scoring/standings";

export async function getAppState() {
  return (
    (await prisma.appState.findUnique({ where: { id: 1 } })) ?? {
      id: 1,
      picksLocked: false,
      lockedAt: null,
      lastSettledAt: null,
    }
  );
}

export type Buckets = {
  group: number; // group-match scorelines
  advance: number; // top-2 + winner/runner-up bonuses
  thirds: number; // best third-place
  knockout: number; // R16/QF/SF/Final advancement
  final: number; // champion + runner-up + third-place winner
};

export type LeaderRow = {
  participantId: string;
  name: string;
  slug: string;
  points: number;
  rank: number;
  prevRank: number | null;
  maxPossible: number;
  movement: number; // prevRank - rank (positive = climbed)
  buckets: Buckets;
};

// Which scoring categories roll up into each leaderboard column.
const BUCKET_OF: Record<string, keyof Buckets> = {
  GROUP_MATCH: "group",
  GROUP_ADVANCE: "advance",
  GROUP_WINNER_BONUS: "advance",
  GROUP_RUNNERUP_BONUS: "advance",
  BEST_THIRD: "thirds",
  ADVANCE_R16: "knockout",
  ADVANCE_QF: "knockout",
  ADVANCE_SF: "knockout",
  ADVANCE_FINAL: "knockout",
  CHAMPION: "final",
  RUNNERUP: "final",
  THIRD_PLACE: "final",
};

export async function getLeaderboard(): Promise<LeaderRow[]> {
  const [standings, grouped] = await Promise.all([
    prisma.standing.findMany({
      include: { participant: true },
      orderBy: [{ rank: "asc" }, { participant: { name: "asc" } }],
    }),
    prisma.scoreLine.groupBy({
      by: ["participantId", "category"],
      _sum: { points: true },
    }),
  ]);

  const bucketsByP = new Map<string, Buckets>();
  for (const g of grouped) {
    const b =
      bucketsByP.get(g.participantId) ??
      { group: 0, advance: 0, thirds: 0, knockout: 0, final: 0 };
    const key = BUCKET_OF[g.category];
    if (key) b[key] += g._sum.points ?? 0;
    bucketsByP.set(g.participantId, b);
  }

  return standings.map((s) => ({
    participantId: s.participantId,
    name: s.participant.name,
    slug: s.participant.slug,
    points: s.totalPoints,
    rank: s.rank,
    prevRank: s.prevRank,
    maxPossible: s.maxPossible,
    movement: s.prevRank == null ? 0 : s.prevRank - s.rank,
    buckets:
      bucketsByP.get(s.participantId) ??
      { group: 0, advance: 0, thirds: 0, knockout: 0, final: 0 },
  }));
}

export type MatchView = {
  id: string;
  stage: string;
  group: string | null;
  slotLabel: string | null;
  kickoff: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  home: { name: string; flag: string; code: string } | null;
  away: { name: string; flag: string; code: string } | null;
  homeSource: string | null; // descriptor when team TBD ("2A", "Winner M74")
  awaySource: string | null;
};

function toView(m: {
  id: string;
  stage: string;
  group: string | null;
  slotLabel: string | null;
  kickoff: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeSource: string | null;
  awaySource: string | null;
  homeTeam: { name: string; flag: string; code: string } | null;
  awayTeam: { name: string; flag: string; code: string } | null;
}): MatchView {
  return {
    id: m.id,
    stage: m.stage,
    group: m.group,
    slotLabel: m.slotLabel,
    kickoff: m.kickoff,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    home: m.homeTeam,
    away: m.awayTeam,
    homeSource: prettySource(m.homeSource),
    awaySource: prettySource(m.awaySource),
  };
}

// "W74" -> "Winner M74", "L101" -> "Loser M101", "2A" -> "Runner-up A",
// "1A" -> "Winner A", "3rd A/B/C" -> "3rd: A/B/C"
function prettySource(s: string | null): string | null {
  if (!s) return null;
  if (/^W\d+$/.test(s)) return `Winner M${s.slice(1)}`;
  if (/^L\d+$/.test(s)) return `Loser M${s.slice(1)}`;
  if (/^1[A-L]$/.test(s)) return `Winner ${s[1]}`;
  if (/^2[A-L]$/.test(s)) return `Runner-up ${s[1]}`;
  if (s.startsWith("3rd")) return s.replace("3rd ", "3rd: ");
  return s;
}

export async function getMatches(): Promise<MatchView[]> {
  const matches = await prisma.match.findMany({
    include: {
      homeTeam: { select: { name: true, flag: true, code: true } },
      awayTeam: { select: { name: true, flag: true, code: true } },
    },
    orderBy: [{ kickoff: "asc" }],
  });
  return matches.map(toView);
}

/** Match drill-down: every participant's pick + points earned + current rank. */
export async function getMatchDetail(id: string) {
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { select: { name: true, flag: true, code: true } },
      awayTeam: { select: { name: true, flag: true, code: true } },
    },
  });
  if (!match) return null;

  const [picks, lines, standings] = await Promise.all([
    prisma.groupMatchPick.findMany({
      where: { matchId: id },
      include: { participant: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.scoreLine.findMany({ where: { matchId: id } }),
    prisma.standing.findMany({ select: { participantId: true, rank: true } }),
  ]);

  const pointsByP = new Map<string, number>();
  for (const l of lines) pointsByP.set(l.participantId, (pointsByP.get(l.participantId) ?? 0) + l.points);
  const rankByP = new Map(standings.map((s) => [s.participantId, s.rank]));

  const rows = picks
    .map((p) => ({
      participantId: p.participant.id,
      name: p.participant.name,
      slug: p.participant.slug,
      predHome: p.predHome,
      predAway: p.predAway,
      points: pointsByP.get(p.participant.id) ?? 0,
      rank: rankByP.get(p.participant.id) ?? null,
    }))
    .sort((a, b) => b.points - a.points || (a.rank ?? 999) - (b.rank ?? 999));

  return { match: toView(match), rows };
}

/** Current group table (live, from finished matches) with advancement markers. */
export async function getGroupTables() {
  const [teams, matches, bestThirds] = await Promise.all([
    prisma.team.findMany(),
    prisma.match.findMany({ where: { stage: "GROUP" } }),
    prisma.bestThirdActual.findMany({ select: { teamId: true } }),
  ]);
  const bestSet = new Set(bestThirds.map((b) => b.teamId));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const groups = [...new Set(teams.map((t) => t.group))].sort();

  return groups.map((g) => {
    const gTeams = teams.filter((t) => t.group === g);
    const gMatches = matches.filter((m) => m.group === g);
    const finished = gMatches.filter(
      (m) => m.status === "FINISHED" && m.homeScore != null && m.awayScore != null,
    );
    const fms: FinishedMatch[] = finished.map((m) => ({
      homeTeamId: m.homeTeamId!,
      awayTeamId: m.awayTeamId!,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
    }));
    const ids = gTeams.map((t) => t.id);
    const table = buildTable(ids, fms);
    const order = computeGroupOrder(ids, fms);
    const allDone = gMatches.length > 0 && finished.length === gMatches.length;
    return {
      group: g,
      complete: allDone,
      rows: order.map((id, i) => {
        const t = teamById.get(id)!;
        const s = table.get(id)!; // includes teamId + stats
        return {
          ...s,
          name: t.name,
          flag: t.flag,
          code: t.code,
          pos: i + 1,
          advancing: i < 2,
          bestThird: bestSet.has(id),
        };
      }),
    };
  });
}

/** Player detail: standing + scorelines grouped by category. */
export async function getPlayer(slug: string) {
  const participant = await prisma.participant.findUnique({
    where: { slug },
    include: { standing: true, finalPick: true },
  });
  if (!participant) return null;
  const lines = await prisma.scoreLine.findMany({
    where: { participantId: participant.id },
    orderBy: { points: "desc" },
  });
  const byCategory = new Map<string, number>();
  for (const l of lines) byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + l.points);
  return { participant, lines, byCategory: [...byCategory.entries()] };
}

export async function getParticipantCount() {
  return prisma.participant.count();
}
