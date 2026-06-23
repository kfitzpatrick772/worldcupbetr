// Read layer for the public board. The serve path only reads pre-computed
// snapshot rows (Standing, ScoreLine) + reference data — it never recomputes
// scores or calls the score API.
import { prisma } from "./db";
import { buildTable, computeGroupOrder } from "./scoring/standings";
import type { FinishedMatch } from "./scoring/standings";
import { clinchedTop2 } from "./scoring/clinch";
import { outcomeOf } from "./scoring/engine";
import { dayKey, formatDay } from "./format";

export async function getAppState() {
  return (
    (await prisma.appState.findUnique({ where: { id: 1 } })) ?? {
      id: 1,
      picksLocked: false,
      lockedAt: null,
      knockoutLocked: false,
      knockoutLockedAt: null,
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

export type FormResult = "hit" | "exact" | "miss";

// Group-stage skill stats derived on read from a player's group-match picks vs
// finished results. This is display-only derivation (hit rate, not score
// recomputation) — the same pattern getPlayerProfile() already uses; it never
// touches Standing/ScoreLine.
export type PickStats = {
  decided: number; // finished group matches the player picked
  correct: number; // right outcome (W/D/L)
  exact: number; // exact scoreline
  pct: number | null; // hit rate %, null until any match is decided
  form: FormResult[]; // up to 5 most recent decided, chronological (oldest→newest)
  streak: number; // current run of correct results from the most recent
};

type PickWithMatch = {
  predHome: number;
  predAway: number;
  match: { status: string; homeScore: number | null; awayScore: number | null; kickoff: Date };
};

function pickStats(picks: PickWithMatch[]): PickStats {
  const finished = picks
    .filter((p) => p.match.status === "FINISHED" && p.match.homeScore != null && p.match.awayScore != null)
    .sort((a, b) => a.match.kickoff.getTime() - b.match.kickoff.getTime());

  let correct = 0;
  let exact = 0;
  const results: FormResult[] = finished.map((p) => {
    const hs = p.match.homeScore!;
    const as = p.match.awayScore!;
    const isExact = p.predHome === hs && p.predAway === as;
    const isCorrect = outcomeOf(hs, as) === outcomeOf(p.predHome, p.predAway);
    if (isCorrect) correct++;
    if (isExact) exact++;
    return isExact ? "exact" : isCorrect ? "hit" : "miss";
  });

  let streak = 0;
  for (let i = results.length - 1; i >= 0 && results[i] !== "miss"; i--) streak++;

  return {
    decided: finished.length,
    correct,
    exact,
    pct: finished.length ? Math.round((correct / finished.length) * 100) : null,
    form: results.slice(-5),
    streak,
  };
}

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
  stats: PickStats;
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

const zeroBuckets = (): Buckets => ({ group: 0, advance: 0, thirds: 0, knockout: 0, final: 0 });

export async function getLeaderboard(): Promise<LeaderRow[]> {
  // Drive the board off the Participant table (not Standing) so a player can
  // never be silently dropped if a settle hasn't created their snapshot yet —
  // the public list always matches the player count.
  const [participants, grouped, picks] = await Promise.all([
    prisma.participant.findMany({ include: { standing: true } }),
    prisma.scoreLine.groupBy({
      by: ["participantId", "category"],
      _sum: { points: true },
    }),
    prisma.groupMatchPick.findMany({
      select: {
        participantId: true,
        predHome: true,
        predAway: true,
        match: { select: { status: true, homeScore: true, awayScore: true, kickoff: true } },
      },
    }),
  ]);

  const bucketsByP = new Map<string, Buckets>();
  for (const g of grouped) {
    const b = bucketsByP.get(g.participantId) ?? zeroBuckets();
    const key = BUCKET_OF[g.category];
    if (key) b[key] += g._sum.points ?? 0;
    bucketsByP.set(g.participantId, b);
  }

  const picksByP = new Map<string, PickWithMatch[]>();
  for (const p of picks) {
    const arr = picksByP.get(p.participantId) ?? [];
    arr.push(p);
    picksByP.set(p.participantId, arr);
  }

  const ranked = participants
    .map((p) => ({
      participantId: p.id,
      name: p.name,
      slug: p.slug,
      points: p.standing?.totalPoints ?? 0,
      prevRank: p.standing?.prevRank ?? null,
      maxPossible: p.standing?.maxPossible ?? 0,
      buckets: bucketsByP.get(p.id) ?? zeroBuckets(),
      stats: pickStats(picksByP.get(p.id) ?? []),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  // Assign display ranks (ties share a rank), mirroring the engine.
  let lastPoints: number | null = null;
  let lastRank = 0;
  return ranked.map((r, i) => {
    const rank = lastPoints === r.points ? lastRank : i + 1;
    lastPoints = r.points;
    lastRank = rank;
    return {
      ...r,
      rank,
      movement: r.prevRank == null ? 0 : r.prevRank - rank,
    };
  });
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
  venue: string | null;
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
  venue: string | null;
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
    venue: m.venue,
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
export type TeamMini = { name: string; flag: string };
export type GroupBreakdown = {
  group: string;
  first: TeamMini | null;
  second: TeamMini | null;
  earned: number;
  potential: number;
  correct: number;
  decided: number;
  picks: number;
};

/** Full player profile: stats bar + per-group breakdown + category totals. */
export async function getPlayerProfile(slug: string) {
  const [p, bestThirdActuals] = await Promise.all([
    prisma.participant.findUnique({
      where: { slug },
      include: {
        standing: true,
        groupStandingPicks: { include: { team: { select: { name: true, flag: true } } } },
        groupMatchPicks: {
          include: { match: { select: { group: true, status: true, homeScore: true, awayScore: true } } },
        },
        bestThirdPicks: { include: { team: { select: { name: true, flag: true } } } },
        finalPick: {
          include: {
            championTeam: { select: { name: true, flag: true } },
            runnerUpTeam: { select: { name: true, flag: true } },
            thirdPlaceTeam: { select: { name: true, flag: true } },
          },
        },
        scoreLines: true,
      },
    }),
    prisma.bestThirdActual.findMany({ select: { teamId: true } }),
  ]);
  if (!p) return null;
  const actualThirds = new Set(bestThirdActuals.map((b) => b.teamId));
  const bestThirdsDecided = actualThirds.size > 0;

  const ptsByGroup = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (const l of p.scoreLines) {
    if (l.group) ptsByGroup.set(l.group, (ptsByGroup.get(l.group) ?? 0) + l.points);
    byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + l.points);
  }

  // overall group-match accuracy
  let decided = 0;
  let correct = 0;
  let exact = 0;
  for (const mp of p.groupMatchPicks) {
    const m = mp.match;
    if (m.status === "FINISHED" && m.homeScore != null && m.awayScore != null) {
      decided++;
      if (outcomeOf(m.homeScore, m.awayScore) === outcomeOf(mp.predHome, mp.predAway)) correct++;
      if (mp.predHome === m.homeScore && mp.predAway === m.awayScore) exact++;
    }
  }

  const ALL_GROUPS = "ABCDEFGHIJKL".split("");
  const firstOf = new Map<string, TeamMini>();
  const secondOf = new Map<string, TeamMini>();
  for (const s of p.groupStandingPicks) {
    (s.position === 1 ? firstOf : secondOf).set(s.group, s.team);
  }

  const byGroup: GroupBreakdown[] = ALL_GROUPS.map((g) => {
    const picks = p.groupMatchPicks.filter((mp) => mp.match.group === g);
    let gDecided = 0;
    let gCorrect = 0;
    for (const mp of picks) {
      const m = mp.match;
      if (m.status === "FINISHED" && m.homeScore != null && m.awayScore != null) {
        gDecided++;
        if (outcomeOf(m.homeScore, m.awayScore) === outcomeOf(mp.predHome, mp.predAway)) gCorrect++;
      }
    }
    return {
      group: g,
      first: firstOf.get(g) ?? null,
      second: secondOf.get(g) ?? null,
      earned: ptsByGroup.get(g) ?? 0,
      // 4/scoreline + advancement (5+5+3+2) only if they actually picked finishers
      potential: picks.length * 4 + (firstOf.has(g) || secondOf.has(g) ? 15 : 0),
      correct: gCorrect,
      decided: gDecided,
      picks: picks.length,
    };
  });

  return {
    participant: { name: p.name, slug: p.slug },
    standing: p.standing,
    stats: {
      decided,
      correct,
      exact,
      pct: decided ? Math.round((correct / decided) * 100) : null,
    },
    byGroup,
    categories: [...byCategory.entries()],
    finalPick: p.finalPick,
    bestThirds: p.bestThirdPicks.map((b) => ({
      name: b.team.name,
      flag: b.team.flag,
      correct: actualThirds.has(b.teamId),
    })),
    bestThirdsDecided,
  };
}

export async function getParticipantCount() {
  return prisma.participant.count();
}

// ----- Bracket (knockout) -------------------------------------------------

export type SlotTeam =
  | { kind: "team"; teamId: string; name: string; flag: string; code: string }
  | { kind: "placeholder"; label: string; variant: "group" | "third" | "winner" };

export type BracketMatch = {
  slotLabel: string;
  stage: string; // R32 | R16 | QF | SF | THIRD | FINAL
  kickoff: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  homeSource: string | null; // raw feeder, e.g. "1C", "2F", "W74"
  awaySource: string | null;
  home: SlotTeam;
  away: SlotTeam;
};

export type BracketData = {
  matches: BracketMatch[]; // all knockout matches, in slot order (M73..M104)
  r32Locked: number; // R32 sides resolved to a real team (out of 32)
};

const slotNum = (label: string) => parseInt(label.replace(/^M/, ""), 10) || 0;

/**
 * Read-time knockout bracket. Each slot resolves to a real team when known —
 * via an explicitly assigned teamId, a mathematically clinched group position,
 * or the winner/loser of an already-played feeder match — otherwise a readable
 * placeholder ("Winner D", "3rd: C/D/F/G/H", "Winner M74"). Display-only
 * derivation off standings + results, like getGroupTables; no writes.
 */
export async function getBracket(): Promise<BracketData> {
  const [teams, allMatches] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, flag: true, code: true, group: true } }),
    prisma.match.findMany({
      select: {
        stage: true, slotLabel: true, group: true, kickoff: true, status: true,
        homeScore: true, awayScore: true, winnerTeamId: true,
        homeTeamId: true, awayTeamId: true, homeSource: true, awaySource: true,
      },
    }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamSlot = (id: string): SlotTeam => {
    const t = teamById.get(id)!;
    return { kind: "team", teamId: t.id, name: t.name, flag: t.flag, code: t.code };
  };

  // Which group positions are locked (clinched, or final once the group is done).
  const clinchByGroup = new Map<string, { first: string | null; second: string | null }>();
  for (const g of [...new Set(teams.map((t) => t.group))]) {
    const ids = teams.filter((t) => t.group === g).map((t) => t.id);
    const gm = allMatches
      .filter((m) => m.stage === "GROUP" && m.group === g)
      .map((m) => ({
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        status: m.status, homeScore: m.homeScore, awayScore: m.awayScore,
      }));
    const c = clinchedTop2(ids, gm);
    clinchByGroup.set(g, { first: c.first, second: c.second });
  }

  const winnerOf = new Map<string, string>();
  const loserOf = new Map<string, string>();

  const resolveSide = (teamId: string | null, source: string | null): SlotTeam => {
    if (teamId) return teamSlot(teamId);
    if (!source) return { kind: "placeholder", label: "TBD", variant: "winner" };
    const gp = /^([12])([A-L])$/.exec(source);
    if (gp) {
      const [, pos, grp] = gp;
      const c = clinchByGroup.get(grp);
      const tid = c ? (pos === "1" ? c.first : c.second) : null;
      if (tid) return teamSlot(tid);
      return { kind: "placeholder", label: pos === "1" ? `Winner ${grp}` : `Runner-up ${grp}`, variant: "group" };
    }
    if (source.startsWith("3rd")) {
      return { kind: "placeholder", label: source.replace("3rd ", "3rd: "), variant: "third" };
    }
    const wl = /^([WL])(\d+)$/.exec(source);
    if (wl) {
      const [, kind, n] = wl;
      const tid = (kind === "W" ? winnerOf : loserOf).get(`M${n}`);
      if (tid) return teamSlot(tid);
      return { kind: "placeholder", label: `${kind === "W" ? "Winner" : "Loser"} M${n}`, variant: "winner" };
    }
    return { kind: "placeholder", label: source, variant: "winner" };
  };

  const matches: BracketMatch[] = [];
  for (const m of allMatches
    .filter((m) => m.slotLabel && m.stage !== "GROUP")
    .sort((a, b) => slotNum(a.slotLabel!) - slotNum(b.slotLabel!))) {
    const home = resolveSide(m.homeTeamId, m.homeSource);
    const away = resolveSide(m.awayTeamId, m.awaySource);
    if (m.status === "FINISHED" && home.kind === "team" && away.kind === "team") {
      let winId = m.winnerTeamId ?? null;
      if (!winId && m.homeScore != null && m.awayScore != null && m.homeScore !== m.awayScore) {
        winId = m.homeScore > m.awayScore ? home.teamId : away.teamId;
      }
      if (winId) {
        winnerOf.set(m.slotLabel!, winId);
        loserOf.set(m.slotLabel!, winId === home.teamId ? away.teamId : home.teamId);
      }
    }
    matches.push({
      slotLabel: m.slotLabel!, stage: m.stage, kickoff: m.kickoff, status: m.status,
      homeScore: m.homeScore, awayScore: m.awayScore, winnerTeamId: m.winnerTeamId,
      homeSource: m.homeSource, awaySource: m.awaySource, home, away,
    });
  }

  const r32Locked = matches
    .filter((m) => m.stage === "R32")
    .reduce((n, m) => n + (m.home.kind === "team" ? 1 : 0) + (m.away.kind === "team" ? 1 : 0), 0);

  return { matches, r32Locked };
}

/** Group-stage progress for the leaderboard's stage bar: finished vs total
 *  group matches. `complete` once the group stage is fully played out. */
export async function getGroupStageProgress(): Promise<{
  played: number;
  total: number;
  complete: boolean;
}> {
  const [played, total] = await Promise.all([
    prisma.match.count({ where: { stage: "GROUP", status: "FINISHED" } }),
    prisma.match.count({ where: { stage: "GROUP" } }),
  ]);
  return { played, total, complete: total > 0 && played === total };
}

/** True once the opening match has kicked off. Lives here (a module function,
 *  not a component) so the time read stays out of the render path. */
export function tournamentUnderway(opener: { kickoff: Date } | null): boolean {
  return !!opener && Date.now() >= opener.kickoff.getTime();
}

/** The most relevant matchday to surface on the board once the tournament is
 *  underway: today's matches (Eastern), else the next upcoming day, else the
 *  final day after it's all over — so the panel is never empty mid-tournament. */
export async function getMatchday(): Promise<
  { kind: "today" | "next" | "last"; label: string; matches: MatchView[] } | null
> {
  const all = await getMatches(); // sorted by kickoff ascending
  if (all.length === 0) return null;
  const now = Date.now();
  const onDay = (key: string) => all.filter((m) => dayKey(m.kickoff) === key);

  const today = onDay(dayKey(new Date()));
  if (today.length) return { kind: "today", label: "Today", matches: today };

  const upcoming = all.find((m) => m.kickoff.getTime() > now);
  if (upcoming) {
    return { kind: "next", label: formatDay(upcoming.kickoff), matches: onDay(dayKey(upcoming.kickoff)) };
  }
  const last = all[all.length - 1];
  return { kind: "last", label: formatDay(last.kickoff), matches: onDay(dayKey(last.kickoff)) };
}

/** The tournament opener (earliest match) with teams + venue. */
export async function getOpener(): Promise<MatchView | null> {
  const m = await prisma.match.findFirst({
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: { select: { name: true, flag: true, code: true } },
      awayTeam: { select: { name: true, flag: true, code: true } },
    },
  });
  return m ? toView(m) : null;
}
