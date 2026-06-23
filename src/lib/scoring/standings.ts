// Pure group-table + best-thirds computation (FIFA 2026 tiebreakers).
//
// 2026 group ranking order (changed from 2022 — head-to-head now comes BEFORE
// overall goal difference):
//   1. points (all group matches)
//   — among teams level on points, the "head-to-head" mini-table of the matches
//     played between exactly those teams:
//   2. head-to-head points
//   3. head-to-head goal difference
//   4. head-to-head goals scored
//   — if still level:
//   5. overall goal difference
//   6. overall goals scored
//   7. fair-play / team-conduct score   (data we don't have)
//   8. FIFA world ranking               (data we don't have)
// then a deterministic alphabetical fallback (admin can override a genuine
// remaining tie). NOTE: criteria 2–4 are applied to the full points-tied subset;
// the rare recursive re-application to a still-tied sub-subset (and 7–8) are not
// modelled — see docs. Third-place ranking (computeBestThirds) is cross-group so
// it has no head-to-head step: points → GD → GF → conduct → ranking.

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

  // 1. Overall points.
  if (b.points !== a.points) return b.points - a.points;

  // 2–4. Head-to-head among ALL teams level on points (2026: before overall GD).
  const tied = [...table.values()].filter((t) => t.points === a.points).map((t) => t.teamId);
  if (tied.length >= 2) {
    const sub = matches.filter(
      (m) => tied.includes(m.homeTeamId) && tied.includes(m.awayTeamId),
    );
    const h2h = buildTable(tied, sub);
    const ha = h2h.get(x)!;
    const hb = h2h.get(y)!;
    if (hb.points !== ha.points) return hb.points - ha.points;
    if (hb.gd !== ha.gd) return hb.gd - ha.gd;
    if (hb.gf !== ha.gf) return hb.gf - ha.gf;
  }

  // 5–6. Overall goal difference, then goals scored.
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;

  // 7–8. Fair-play conduct, then FIFA ranking — data we don't have.
  // Deterministic fallback; admin can override a genuine remaining tie.
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
