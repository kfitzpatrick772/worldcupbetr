// Mathematical clinch detection for group positions — drives the public bracket
// so a team drops into its R32 slot the moment its 1st/2nd finish is certain,
// not only when the whole group is played out.
//
// Soundness note: a position is only "clinched" when it is guaranteed on POINTS
// (plus results already played). Goal-difference swings are unbounded — a team
// can win by any margin — so GD can never make a future position mathematically
// certain. This is the correct, conservative notion: we may reveal a slot a hair
// later than a human eyeballing GD would, but we never show a team that could
// still be bumped. Once every group match is played we defer to the full
// tiebreaker order in computeGroupOrder().

import { buildTable, computeGroupOrder } from "./standings";
import type { FinishedMatch } from "./standings";

export interface GroupMatchLite {
  homeTeamId: string | null;
  awayTeamId: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ClinchResult {
  first: string | null; // teamId certain to win the group (else null)
  second: string | null; // teamId certain to finish runner-up (else null)
  complete: boolean; // every group match has been played
}

function isFinished(m: GroupMatchLite): boolean {
  return (
    m.status === "FINISHED" &&
    m.homeTeamId != null &&
    m.awayTeamId != null &&
    m.homeScore != null &&
    m.awayScore != null
  );
}

/** Which of a group's positions (1st / 2nd) are already mathematically locked. */
export function clinchedTop2(teamIds: string[], groupMatches: GroupMatchLite[]): ClinchResult {
  const finished: FinishedMatch[] = groupMatches.filter(isFinished).map((m) => ({
    homeTeamId: m.homeTeamId!,
    awayTeamId: m.awayTeamId!,
    homeScore: m.homeScore!,
    awayScore: m.awayScore!,
  }));

  const remaining = groupMatches.filter((m) => !isFinished(m));
  const complete = groupMatches.length > 0 && remaining.length === 0;

  if (complete) {
    const order = computeGroupOrder(teamIds, finished);
    return { first: order[0] ?? null, second: order[1] ?? null, complete: true };
  }

  const table = buildTable(teamIds, finished);
  const remByTeam = new Map<string, number>(teamIds.map((t) => [t, 0]));
  for (const m of remaining) {
    if (m.homeTeamId) remByTeam.set(m.homeTeamId, (remByTeam.get(m.homeTeamId) ?? 0) + 1);
    if (m.awayTeamId) remByTeam.set(m.awayTeamId, (remByTeam.get(m.awayTeamId) ?? 0) + 1);
  }
  const minPts = (t: string) => table.get(t)?.points ?? 0;
  const maxPts = (t: string) => (table.get(t)?.points ?? 0) + 3 * (remByTeam.get(t) ?? 0);

  // The top team of `pool` is locked if everyone else, at their best, still can't
  // reach its worst-case points total.
  const lockedTopOf = (pool: string[]): string | null => {
    for (const t of pool) {
      if (pool.every((u) => u === t || maxPts(u) < minPts(t))) return t;
    }
    return null;
  };

  const first = lockedTopOf(teamIds);
  // Second is only knowable once first is settled (otherwise we can't say which
  // of the leaders is the runner-up vs the winner).
  const second = first ? lockedTopOf(teamIds.filter((t) => t !== first)) : null;
  return { first, second, complete: false };
}
