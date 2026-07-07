// "Path to the Trophy" analysis — who can still win the pool and what must
// happen. Pure and testable (no DB): the query layer assembles the inputs.
//
// Two layers:
//  1. Heuristic (always): classify each player's knockout picks as already
//     earned (locked), still-possible (live), or dead; a TIGHT max that only
//     counts live picks (the engine's own maxPossible is deliberately loose);
//     sound pool-level elimination + clinch; a status label.
//  2. Exact (once the bracket is small enough to enumerate): every remaining
//     outcome is played out to get each player's win share and the results that
//     MUST happen for them to win.

import { POINTS } from "./engine";
import { R32_SLOTS, R16_SLOTS, QF_SLOTS, SF_SLOTS, THIRD_SLOT, FINAL_SLOT, TREE } from "../bracket";

export type Round = "R16" | "QF" | "SF" | "FINAL";
export type Stage = "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";
export type StakeStatus = "locked" | "live" | "dead";

const REACH_LABEL: Record<Round, string> = {
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  FINAL: "Final",
};

export interface PathPlayer {
  participantId: string;
  name: string;
  slug: string;
  locked: number; // Standing.totalPoints (locked overall)
  groupPart: number; // locked points from group stage only (constant in KO scenarios)
  advance: { round: Round; teamId: string }[];
  championId: string | null;
  runnerUpId: string | null;
  thirdId: string | null;
}

export interface KnockoutState {
  reached: Record<Round, Set<string>>; // AdvanceActual: who reached each round
  eliminatedAt: Map<string, Stage>; // team -> stage it lost (absent = still alive)
  final: { championId: string | null; runnerUpId: string | null; thirdId: string | null };
  finalizedRounds: Set<Round>;
}

export interface Stake {
  teamId: string;
  label: string; // "Champion", "Final", "Semi-final"…
  points: number;
  status: StakeStatus;
}

export interface PlayerPath {
  participantId: string;
  name: string;
  slug: string;
  locked: number;
  tightMax: number; // locked + live stakes
  gapToLead: number; // locked - highest OTHER locked (negative = behind, positive = lead)
  stakes: Stake[];
  eliminated: boolean;
  clinched: boolean;
  status: "clinched" | "in_control" | "contender" | "long_shot" | "eliminated";
}

/* ---------------- Layer 1: heuristic ---------------- */

function advanceStatus(round: Round, teamId: string, s: KnockoutState): StakeStatus {
  if (s.reached[round].has(teamId)) return "locked";
  if (s.eliminatedAt.has(teamId)) return "dead";
  if (s.finalizedRounds.has(round)) return "dead"; // round decided, team not in it
  return "live";
}

function championStatus(teamId: string, s: KnockoutState): StakeStatus {
  if (s.final.championId) return s.final.championId === teamId ? "locked" : "dead";
  return s.eliminatedAt.has(teamId) ? "dead" : "live";
}
function runnerUpStatus(teamId: string, s: KnockoutState): StakeStatus {
  if (s.final.runnerUpId) return s.final.runnerUpId === teamId ? "locked" : "dead";
  return s.eliminatedAt.has(teamId) ? "dead" : "live"; // out before the final → can't be runner-up
}
function thirdStatus(teamId: string, s: KnockoutState): StakeStatus {
  if (s.final.thirdId) return s.final.thirdId === teamId ? "locked" : "dead";
  const st = s.eliminatedAt.get(teamId);
  if (st === "R32" || st === "R16" || st === "QF") return "dead"; // out before the semis
  return "live";
}

function stakesFor(p: PathPlayer, s: KnockoutState): Stake[] {
  const out: Stake[] = [];
  for (const a of p.advance) {
    out.push({
      teamId: a.teamId,
      label: REACH_LABEL[a.round],
      points: POINTS.reach[a.round],
      status: advanceStatus(a.round, a.teamId, s),
    });
  }
  if (p.championId)
    out.push({ teamId: p.championId, label: "Champion", points: POINTS.champion, status: championStatus(p.championId, s) });
  if (p.runnerUpId)
    out.push({ teamId: p.runnerUpId, label: "Runner-up", points: POINTS.runnerUp, status: runnerUpStatus(p.runnerUpId, s) });
  if (p.thirdId)
    out.push({ teamId: p.thirdId, label: "Third place", points: POINTS.thirdPlace, status: thirdStatus(p.thirdId, s) });
  // Highest-value stakes first for display.
  return out.sort((a, b) => b.points - a.points);
}

/** Heuristic per-player analysis. Elimination is SOUND (never marks a player
 *  out who could still win): X is out iff some rival's locked floor already
 *  exceeds X's tight ceiling. Clinch is sound too. */
export function analyzePaths(players: PathPlayer[], state: KnockoutState): PlayerPath[] {
  const enriched = players.map((p) => {
    const stakes = stakesFor(p, state);
    const live = stakes.filter((s) => s.status === "live").reduce((n, s) => n + s.points, 0);
    return { p, stakes, tightMax: p.locked + live };
  });

  const rows: PlayerPath[] = enriched.map(({ p, stakes, tightMax }) => {
    const othersLocked = enriched.filter((e) => e.p.participantId !== p.participantId).map((e) => e.p.locked);
    const othersMax = enriched.filter((e) => e.p.participantId !== p.participantId).map((e) => e.tightMax);
    const topOtherLocked = othersLocked.length ? Math.max(...othersLocked) : 0;
    const topOtherMax = othersMax.length ? Math.max(...othersMax) : 0;

    const eliminated = tightMax < topOtherLocked; // a rival is already guaranteed more than my ceiling
    const clinched = !eliminated && p.locked >= topOtherMax; // my floor beats everyone's ceiling
    const isLeader = p.locked >= topOtherLocked;
    const gapToLead = p.locked - topOtherLocked;

    let status: PlayerPath["status"];
    if (clinched) status = "clinched";
    else if (eliminated) status = "eliminated";
    else if (isLeader) status = "in_control";
    else {
      const deficit = topOtherLocked - p.locked;
      const biggestLive = Math.max(0, ...stakes.filter((s) => s.status === "live").map((s) => s.points));
      status = deficit <= biggestLive ? "contender" : "long_shot";
    }

    return {
      participantId: p.participantId, name: p.name, slug: p.slug,
      locked: p.locked, tightMax, gapToLead, stakes, eliminated, clinched, status,
    };
  });

  // Sort: contenders first (by locked desc), eliminated last.
  return rows.sort(
    (a, b) => Number(a.eliminated) - Number(b.eliminated) || b.locked - a.locked || a.name.localeCompare(b.name),
  );
}

/* ---------------- Layer 2: exact enumeration ---------------- */

const KO_ORDER = [...R32_SLOTS, ...R16_SLOTS, ...QF_SLOTS, ...SF_SLOTS, THIRD_SLOT, FINAL_SLOT];

export interface KoSlot {
  slot: string;
  home: string | null;
  away: string | null;
  winner: string | null; // set when the match is finished
}

export interface ExactResult {
  totalScenarios: number;
  // participantId -> analysis
  byPlayer: Map<
    string,
    { winShare: number; clinched: boolean; eliminated: boolean; mustHappen: { slot: string; teamId: string }[] }
  >;
}

function participants(slot: string, slots: Map<string, KoSlot>, winners: Map<string, string>): [string | null, string | null] {
  if (R32_SLOTS.includes(slot)) {
    const s = slots.get(slot);
    return [s?.home ?? null, s?.away ?? null];
  }
  const [fa, fb] = TREE[slot];
  const side = (f: { slot: string; result: "W" | "L" }): string | null => {
    const w = winners.get(f.slot);
    if (!w) return null;
    if (f.result === "W") return w;
    const [ph, pa] = participants(f.slot, slots, winners);
    return ph && ph !== w ? ph : pa && pa !== w ? pa : null;
  };
  return [side(fa), side(fb)];
}

/** Exact per-player win analysis by enumerating every remaining outcome.
 *  Returns null if the remaining bracket is too large to enumerate cheaply. */
export function exactPaths(
  players: PathPlayer[],
  slots: Map<string, KoSlot>,
  maxUndecided = 12,
): ExactResult | null {
  const undecided = KO_ORDER.filter((s) => slots.has(s) && !slots.get(s)!.winner);
  if (undecided.length === 0 || undecided.length > maxUndecided) return null;

  // Pre-evaluate a scenario's knockout score for a player.
  const scoreKO = (p: PathPlayer, reached: Record<Round, Set<string>>, ch: string | null, ru: string | null, th: string | null) => {
    let pts = 0;
    for (const a of p.advance) if (reached[a.round].has(a.teamId)) pts += POINTS.reach[a.round];
    if (p.championId && ch === p.championId) pts += POINTS.champion;
    if (p.runnerUpId && ru === p.runnerUpId) pts += POINTS.runnerUp;
    if (p.thirdId && th === p.thirdId) pts += POINTS.thirdPlace;
    return pts;
  };

  const total = { n: 0 };
  const winCount = new Map<string, number>(players.map((p) => [p.participantId, 0]));
  // For necessary conditions: per player, per undecided slot, the set of winners across their winning scenarios.
  const condWinners = new Map<string, Map<string, Set<string>>>(
    players.map((p) => [p.participantId, new Map(undecided.map((s) => [s, new Set<string>()]))]),
  );

  const winners = new Map<string, string>();
  for (const s of KO_ORDER) {
    const w = slots.get(s)?.winner;
    if (w) winners.set(s, w);
  }

  const evalLeaf = () => {
    const reached: Record<Round, Set<string>> = { R16: new Set(), QF: new Set(), SF: new Set(), FINAL: new Set() };
    for (const s of R32_SLOTS) { const w = winners.get(s); if (w) reached.R16.add(w); }
    for (const s of R16_SLOTS) { const w = winners.get(s); if (w) reached.QF.add(w); }
    for (const s of QF_SLOTS) { const w = winners.get(s); if (w) reached.SF.add(w); }
    for (const s of SF_SLOTS) { const w = winners.get(s); if (w) reached.FINAL.add(w); }
    const ch = winners.get(FINAL_SLOT) ?? null;
    const [fh, fa] = participants(FINAL_SLOT, slots, winners);
    const ru = ch ? (fh === ch ? fa : fh) : null;
    const th = winners.get(THIRD_SLOT) ?? null;

    let best = -Infinity;
    const scores = players.map((p) => {
      const sc = p.groupPart + scoreKO(p, reached, ch, ru, th);
      if (sc > best) best = sc;
      return sc;
    });
    total.n++;
    players.forEach((p, i) => {
      if (scores[i] === best) {
        winCount.set(p.participantId, winCount.get(p.participantId)! + 1);
        const cw = condWinners.get(p.participantId)!;
        for (const s of undecided) cw.get(s)!.add(winners.get(s)!);
      }
    });
  };

  const rec = (i: number) => {
    if (i >= KO_ORDER.length) { evalLeaf(); return; }
    const slot = KO_ORDER[i];
    if (!slots.has(slot)) { rec(i + 1); return; }
    if (winners.has(slot)) { rec(i + 1); return; } // decided
    const [h, a] = participants(slot, slots, winners);
    if (!h || !a) { rec(i + 1); return; } // unresolvable participants
    for (const w of [h, a]) {
      winners.set(slot, w);
      rec(i + 1);
      winners.delete(slot);
    }
  };
  rec(0);

  const byPlayer: ExactResult["byPlayer"] = new Map();
  for (const p of players) {
    const wins = winCount.get(p.participantId)!;
    const cw = condWinners.get(p.participantId)!;
    const mustHappen: { slot: string; teamId: string }[] = [];
    if (wins > 0) {
      for (const s of undecided) {
        const set = cw.get(s)!;
        if (set.size === 1) mustHappen.push({ slot: s, teamId: [...set][0] }); // unanimous across wins
      }
    }
    byPlayer.set(p.participantId, {
      winShare: wins / total.n,
      clinched: wins === total.n,
      eliminated: wins === 0,
      mustHappen,
    });
  }
  return { totalScenarios: total.n, byPlayer };
}
