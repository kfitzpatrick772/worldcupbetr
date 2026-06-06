// Pure group-table + best-thirds computation (FIFA 2026 tiebreakers).
//
// Order: (1) points, (2) goal difference, (3) goals for, (4) head-to-head among
// the tied subset (points, GD, GF in matches between them), then a deterministic
// alphabetical fallback (FIFA's fair-play / drawing-of-lots steps need data we
// don't have — the admin can override the rare true tie).

export interface FinishedMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface TeamStat {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

function blank(teamId: string): TeamStat {
  return { teamId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

/** Accumulate a table from a set of finished matches over the given teams. */
export function buildTable(teamIds: string[], matches: FinishedMatch[]): Map<string, TeamStat> {
  const table = new Map(teamIds.map((id) => [id, blank(id)]));
  for (const m of matches) {
    const h = table.get(m.homeTeamId);
    const a = table.get(m.awayTeamId);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.won++; a.lost++; h.points += 3; }
    else if (m.homeScore < m.awayScore) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  for (const s of table.values()) s.gd = s.gf - s.ga;
  return table;
}

/**
 * Order teams in a single group, positions 1..4. Returns teamIds in finishing
 * order. `matches` should be the group's matches (finished ones counted).
 */
export function computeGroupOrder(teamIds: string[], matches: FinishedMatch[]): string[] {
  const table = buildTable(teamIds, matches);
  return [...teamIds].sort((x, y) => compareInGroup(x, y, table, matches));
}

function compareInGroup(
  x: string,
  y: string,
  table: Map<string, TeamStat>,
  matches: FinishedMatch[],
): number {
  const a = table.get(x)!;
  const b = table.get(y)!;
  const overall = compareStats(a, b);
  if (overall !== 0) return overall;

  // Head-to-head among the full tied subset (teams equal on pts/GD/GF overall).
  const tied = [...table.values()]
    .filter((t) => compareStats(t, a) === 0)
    .map((t) => t.teamId);
  if (tied.length >= 2) {
    const sub = matches.filter(
      (m) => tied.includes(m.homeTeamId) && tied.includes(m.awayTeamId),
    );
    const h2h = buildTable(tied, sub);
    const ha = h2h.get(x)!;
    const hb = h2h.get(y)!;
    const h2hCmp = compareStats(ha, hb);
    if (h2hCmp !== 0) return h2hCmp;
  }
  // Deterministic final fallback (admin can override true ties).
  return x < y ? -1 : x > y ? 1 : 0;
}

function compareStats(a: TeamStat, b: TeamStat): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return 0;
}

/**
 * Pick the 8 best third-placed teams from the 12 groups. Input: each group's
 * third-placed team with its full-group stats. Returns the 8 qualifying teamIds.
 */
export function computeBestThirds(thirds: TeamStat[]): string[] {
  return [...thirds]
    .sort((a, b) => {
      const c = compareStats(a, b);
      if (c !== 0) return c;
      return a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;
    })
    .slice(0, 8)
    .map((t) => t.teamId);
}
