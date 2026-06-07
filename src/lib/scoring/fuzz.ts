// Randomized property test ("fuzz") for the scoring engine.
//
// The idea: generate a whole synthetic world — random match results plus 12
// players whose picks span every category (group scorelines, advancement,
// best-thirds, knockout reaches, the final) — then grade everyone two ways:
//
//   1. the real engine  (scoreParticipant)
//   2. an INDEPENDENT oracle written here, from the rulebook, in a deliberately
//      different style and WITHOUT importing the engine's POINTS table.
//
// If the two ever disagree, one of them has a bug. Every run is driven by a
// seed, so any failure is perfectly reproducible: the UI shows the seed, the
// player, and the exact category that diverged, which is what you need to fix
// the engine. Add a failing seed to REGRESSION_SEEDS so it's checked forever.
//
// This is NOT machine learning. There is no model, no training, no automatic
// "improvement" of the engine. The only thing that persists is REGRESSION_SEEDS
// (failed cases re-checked forever); fixing the engine is a human reading the
// pinpointed case. The value is brute force: thousands of independent random
// cases, each cross-checked, catch bugs no hand-written test thought to.
//
// Pure + dependency-light (only the engine + types) so it runs entirely in the
// browser (no server, no DB, no network — hence the speed) and in Vitest for CI.

import { scoreParticipant } from "./engine";
import type {
  Actuals,
  AdvanceRound,
  MatchResult,
  ParticipantPicks,
  ScoreCategory,
} from "./types";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic, so a seed fully reproduces a run.
// ---------------------------------------------------------------------------
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const intn = (r: Rng, n: number) => Math.floor(r() * n);
const chance = (r: Rng, p: number) => r() < p;
const pickOne = <T>(r: Rng, xs: readonly T[]): T => xs[intn(r, xs.length)];
function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = intn(r, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Synthetic universe: 4 groups × 4 teams (teamIds like "A0"), 6 round-robin
// matches per group. Enough to exercise every scoring path including the
// 8-team best-third pool and four knockout rounds.
// ---------------------------------------------------------------------------
const GROUPS = ["A", "B", "C", "D"] as const;
const ROUNDS: AdvanceRound[] = ["R16", "QF", "SF", "FINAL"];
const ALL_TEAMS: string[] = GROUPS.flatMap((g) => [0, 1, 2, 3].map((i) => `${g}${i}`));
const RR_PAIRS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];
const STATUSES: MatchResult["status"][] = ["SCHEDULED", "LIVE", "FINISHED"];

export interface Scenario {
  seed: number;
  matches: MatchResult[];
  actuals: Actuals;
  players: ParticipantPicks[];
}

function genActuals(r: Rng): { matches: MatchResult[]; actuals: Actuals } {
  const matches: MatchResult[] = [];
  const groupStandings: Actuals["groupStandings"] = [];
  const groupsFinalized: string[] = [];

  for (const g of GROUPS) {
    const teams = [0, 1, 2, 3].map((i) => `${g}${i}`);
    // random finishing order → positions 1..4
    const order = shuffle(r, teams);
    order.forEach((teamId, i) => groupStandings.push({ group: g, position: i + 1, teamId }));
    if (chance(r, 0.6)) groupsFinalized.push(g);

    for (const [i, j] of RR_PAIRS) {
      const status = pickOne(r, STATUSES);
      // mostly real scores; occasionally a non-scheduled match with no score yet
      const hasScore = status !== "SCHEDULED" && chance(r, 0.92);
      matches.push({
        id: `${g}-${i}-${j}`,
        stage: "GROUP",
        group: g,
        homeTeamId: `${g}${i}`,
        awayTeamId: `${g}${j}`,
        homeScore: hasScore ? intn(r, 5) : null,
        awayScore: hasScore ? intn(r, 5) : null,
        status,
      });
    }
  }

  const bestThirds = shuffle(r, ALL_TEAMS).slice(0, 8);
  const bestThirdsFinalized = chance(r, 0.6);

  const advance: Actuals["advance"] = [];
  const advanceFinalized: AdvanceRound[] = [];
  for (const round of ROUNDS) {
    const survivors = shuffle(r, ALL_TEAMS).slice(0, intn(r, 7)); // 0..6 teams
    for (const teamId of survivors) advance.push({ round, teamId });
    if (chance(r, 0.5)) advanceFinalized.push(round);
  }

  const maybeTeam = (p: number) => (chance(r, p) ? pickOne(r, ALL_TEAMS) : null);
  const actuals: Actuals = {
    groupStandings,
    groupsFinalized,
    bestThirds,
    bestThirdsFinalized,
    advance,
    advanceFinalized,
    final: {
      championTeamId: maybeTeam(0.6),
      runnerUpTeamId: maybeTeam(0.6),
      thirdPlaceTeamId: maybeTeam(0.6),
    },
  };
  return { matches, actuals };
}

function genPlayer(r: Rng, id: string, matches: MatchResult[], actuals: Actuals): ParticipantPicks {
  const posTeam = (g: string, pos: number) =>
    actuals.groupStandings.find((s) => s.group === g && s.position === pos)?.teamId ?? null;

  // 1. group-match scorelines — sometimes copy the real score (exact bonus path),
  //    sometimes a ghost matchId (exercises the "match not found" guards).
  const groupMatch: ParticipantPicks["groupMatch"] = [];
  for (const m of matches) {
    if (!chance(r, 0.8)) continue;
    if (m.homeScore != null && chance(r, 0.3)) {
      groupMatch.push({ matchId: m.id, predHome: m.homeScore, predAway: m.awayScore ?? 0 });
    } else {
      groupMatch.push({ matchId: m.id, predHome: intn(r, 5), predAway: intn(r, 5) });
    }
  }
  if (chance(r, 0.15)) groupMatch.push({ matchId: "GHOST", predHome: intn(r, 5), predAway: intn(r, 5) });

  // 2. group standings (top 2) — mix correct/wrong, with an occasional invalid
  //    duplicate (same team in both slots) to test the engine's de-dup.
  const groupStanding: ParticipantPicks["groupStanding"] = [];
  for (const g of GROUPS) {
    if (!chance(r, 0.85)) continue;
    const first = chance(r, 0.4) ? posTeam(g, 1) ?? pickOne(r, ALL_TEAMS) : pickOne(r, ALL_TEAMS);
    let second = chance(r, 0.4) ? posTeam(g, 2) ?? pickOne(r, ALL_TEAMS) : pickOne(r, ALL_TEAMS);
    if (chance(r, 0.08)) second = first; // invalid duplicate
    groupStanding.push({ group: g, position: 1, teamId: first });
    groupStanding.push({ group: g, position: 2, teamId: second });
  }

  // 3. best thirds — k picks blending real qualifiers + noise, rare duplicate.
  const bestThird: string[] = [];
  const k = intn(r, 9); // 0..8
  for (let i = 0; i < k; i++) {
    bestThird.push(chance(r, 0.5) ? pickOne(r, actuals.bestThirds) : pickOne(r, ALL_TEAMS));
  }
  if (bestThird.length && chance(r, 0.1)) bestThird.push(bestThird[0]); // duplicate

  // 4. knockout advancement — (round, team) pairs, some real, rare duplicate.
  const advance: ParticipantPicks["advance"] = [];
  const realByRound = new Map<AdvanceRound, string[]>();
  for (const a of actuals.advance) {
    if (!realByRound.has(a.round)) realByRound.set(a.round, []);
    realByRound.get(a.round)!.push(a.teamId);
  }
  for (const round of ROUNDS) {
    const n = intn(r, 5); // 0..4 picks
    const real = realByRound.get(round) ?? [];
    for (let i = 0; i < n; i++) {
      const teamId = real.length && chance(r, 0.4) ? pickOne(r, real) : pickOne(r, ALL_TEAMS);
      advance.push({ round, teamId });
    }
  }
  if (advance.length && chance(r, 0.1)) advance.push(advance[0]); // duplicate

  // 5. final — present 80% of the time; each slot real-or-random.
  const slot = (actual: string | null) =>
    actual && chance(r, 0.4) ? actual : pickOne(r, ALL_TEAMS);
  const final = chance(r, 0.8)
    ? {
        championTeamId: slot(actuals.final.championTeamId),
        runnerUpTeamId: slot(actuals.final.runnerUpTeamId),
        thirdPlaceTeamId: slot(actuals.final.thirdPlaceTeamId),
      }
    : null;

  return { participantId: id, groupMatch, groupStanding, bestThird, advance, final };
}

export function generateScenario(seed: number, players = 12): Scenario {
  const r = makeRng(seed);
  const { matches, actuals } = genActuals(r);
  const list = Array.from({ length: players }, (_, i) => genPlayer(r, `P${i}`, matches, actuals));
  return { seed, matches, actuals, players: list };
}

// ---------------------------------------------------------------------------
// The INDEPENDENT oracle. Hand-written from the league rulebook; uses literal
// point values (NOT engine.POINTS) and a category-sum shape (NOT the engine's
// line[] + provisional flag), so a bug in the engine won't be mirrored here.
//
// Returns per-category live + locked points (locked = finished/finalized only)
// and an independent maxPossible ceiling.
// ---------------------------------------------------------------------------
const REACH: Record<AdvanceRound, number> = { R16: 10, QF: 20, SF: 40, FINAL: 80 };
const CATS: ScoreCategory[] = [
  "GROUP_MATCH", "GROUP_ADVANCE", "GROUP_WINNER_BONUS", "GROUP_RUNNERUP_BONUS",
  "BEST_THIRD", "ADVANCE_R16", "ADVANCE_QF", "ADVANCE_SF", "ADVANCE_FINAL",
  "CHAMPION", "RUNNERUP", "THIRD_PLACE",
];
const ADVANCE_CAT: Record<AdvanceRound, ScoreCategory> = {
  R16: "ADVANCE_R16", QF: "ADVANCE_QF", SF: "ADVANCE_SF", FINAL: "ADVANCE_FINAL",
};

export interface OracleScore {
  live: Record<ScoreCategory, number>;
  locked: Record<ScoreCategory, number>;
  totalLive: number;
  totalLocked: number;
  maxPossible: number;
}

export function oracleScore(
  picks: ParticipantPicks,
  matchesById: Map<string, MatchResult>,
  actuals: Actuals,
): OracleScore {
  const live = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<ScoreCategory, number>;
  const locked = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<ScoreCategory, number>;
  const award = (cat: ScoreCategory, pts: number, provisional: boolean) => {
    live[cat] += pts;
    if (!provisional) locked[cat] += pts;
  };
  const sgn = (a: number, b: number) => (a === b ? 0 : a > b ? 1 : -1);

  // 1. group matches (LIVE counts live-only; FINISHED counts both)
  for (const gp of picks.groupMatch) {
    const m = matchesById.get(gp.matchId);
    if (!m || m.status === "SCHEDULED" || m.homeScore == null || m.awayScore == null) continue;
    let pts = 0;
    if (sgn(gp.predHome, gp.predAway) === sgn(m.homeScore, m.awayScore)) {
      pts = 2;
      if (gp.predHome === m.homeScore && gp.predAway === m.awayScore) pts += 2;
    }
    if (pts) award("GROUP_MATCH", pts, m.status === "LIVE");
  }

  // 2. group advancement (only for finalized groups; never provisional)
  for (const g of actuals.groupsFinalized) {
    const a1 = actuals.groupStandings.find((s) => s.group === g && s.position === 1)?.teamId ?? null;
    const a2 = actuals.groupStandings.find((s) => s.group === g && s.position === 2)?.teamId ?? null;
    const top2 = new Set([a1, a2].filter((x): x is string => x != null));
    const mine = picks.groupStanding.filter((s) => s.group === g);
    for (const teamId of new Set(mine.map((s) => s.teamId))) {
      if (top2.has(teamId)) award("GROUP_ADVANCE", 5, false);
    }
    const my1 = mine.find((s) => s.position === 1)?.teamId;
    const my2 = mine.find((s) => s.position === 2)?.teamId;
    if (my1 && a1 && my1 === a1) award("GROUP_WINNER_BONUS", 3, false);
    if (my2 && a2 && my2 === a2) award("GROUP_RUNNERUP_BONUS", 2, false);
  }

  // 3. best thirds
  if (actuals.bestThirdsFinalized) {
    const real = new Set(actuals.bestThirds);
    for (const teamId of new Set(picks.bestThird)) {
      if (real.has(teamId)) award("BEST_THIRD", 5, false);
    }
  }

  // 4. knockout reaches (set membership, de-duped on round+team)
  const realByRound = new Map<AdvanceRound, Set<string>>();
  for (const a of actuals.advance) {
    if (!realByRound.has(a.round)) realByRound.set(a.round, new Set());
    realByRound.get(a.round)!.add(a.teamId);
  }
  const seen = new Set<string>();
  for (const p of picks.advance) {
    const key = `${p.round}|${p.teamId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (realByRound.get(p.round)?.has(p.teamId)) award(ADVANCE_CAT[p.round], REACH[p.round], false);
  }

  // 5. final placements
  if (picks.final) {
    const f = actuals.final;
    if (f.championTeamId && picks.final.championTeamId === f.championTeamId) award("CHAMPION", 160, false);
    if (f.runnerUpTeamId && picks.final.runnerUpTeamId === f.runnerUpTeamId) award("RUNNERUP", 40, false);
    if (f.thirdPlaceTeamId && picks.final.thirdPlaceTeamId === f.thirdPlaceTeamId) award("THIRD_PLACE", 40, false);
  }

  const totalLive = CATS.reduce((s, c) => s + live[c], 0);
  const totalLocked = CATS.reduce((s, c) => s + locked[c], 0);

  // maxPossible = locked + a safe ceiling on everything still undecided.
  let ceil = 0;
  for (const gp of picks.groupMatch) {
    const m = matchesById.get(gp.matchId);
    if (!m || m.status !== "FINISHED") ceil += 4; // up to result(2)+exact(2)
  }
  const finalizedGroups = new Set(actuals.groupsFinalized);
  for (const g of new Set(picks.groupStanding.map((s) => s.group))) {
    if (!finalizedGroups.has(g)) ceil += 15; // 5+5+3+2
  }
  if (!actuals.bestThirdsFinalized) ceil += new Set(picks.bestThird).size * 5;
  const finalizedRounds = new Set(actuals.advanceFinalized);
  const distinctByRound = new Map<AdvanceRound, Set<string>>();
  for (const p of picks.advance) {
    if (!distinctByRound.has(p.round)) distinctByRound.set(p.round, new Set());
    distinctByRound.get(p.round)!.add(p.teamId);
  }
  for (const round of ROUNDS) {
    if (finalizedRounds.has(round)) continue;
    const distinct = distinctByRound.get(round) ?? new Set<string>();
    let awarded = 0;
    for (const t of distinct) if (realByRound.get(round)?.has(t)) awarded++;
    ceil += Math.max(0, distinct.size - awarded) * REACH[round];
  }
  if (picks.final) {
    if (!actuals.final.championTeamId) ceil += 160;
    if (!actuals.final.runnerUpTeamId) ceil += 40;
    if (!actuals.final.thirdPlaceTeamId) ceil += 40;
  }

  return { live, locked, totalLive, totalLocked, maxPossible: totalLocked + ceil };
}

// ---------------------------------------------------------------------------
// Compare engine vs oracle for one scenario.
// ---------------------------------------------------------------------------
export interface FuzzFailure {
  seed: number;
  playerIndex: number;
  category: ScoreCategory | "TOTAL" | "MAX";
  field: "live" | "locked" | "max";
  expected: number; // oracle (rulebook)
  got: number; // engine
  repro: string; // human-readable reproducing case
}

function bucketEngine(lines: { category: ScoreCategory; points: number; provisional?: boolean }[]) {
  const live = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<ScoreCategory, number>;
  const locked = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<ScoreCategory, number>;
  for (const l of lines) {
    live[l.category] += l.points;
    if (!l.provisional) locked[l.category] += l.points;
  }
  return { live, locked };
}

function reproFor(scenario: Scenario, i: number, category: string): string {
  const p = scenario.players[i];
  const a = scenario.actuals;
  const lines: string[] = [`seed=${scenario.seed} player=${i} category=${category}`];
  switch (category) {
    case "GROUP_MATCH":
      lines.push(
        "picks: " + p.groupMatch.map((g) => `${g.matchId}:${g.predHome}-${g.predAway}`).join(", "),
        "results: " + scenario.matches
          .filter((m) => p.groupMatch.some((g) => g.matchId === m.id))
          .map((m) => `${m.id}:${m.homeScore ?? "·"}-${m.awayScore ?? "·"}/${m.status}`)
          .join(", "),
      );
      break;
    case "GROUP_ADVANCE":
    case "GROUP_WINNER_BONUS":
    case "GROUP_RUNNERUP_BONUS":
      lines.push(
        "standing picks: " + p.groupStanding.map((s) => `${s.group}#${s.position}=${s.teamId}`).join(", "),
        "finalized: " + a.groupsFinalized.join(",") || "finalized: (none)",
        "actual top2: " + a.groupsFinalized
          .map((g) => `${g}:${a.groupStandings.find((s) => s.group === g && s.position === 1)?.teamId}/${a.groupStandings.find((s) => s.group === g && s.position === 2)?.teamId}`)
          .join(", "),
      );
      break;
    case "BEST_THIRD":
      lines.push(
        "picks: " + p.bestThird.join(", "),
        `actual (finalized=${a.bestThirdsFinalized}): ` + a.bestThirds.join(", "),
      );
      break;
    case "ADVANCE_R16":
    case "ADVANCE_QF":
    case "ADVANCE_SF":
    case "ADVANCE_FINAL":
      lines.push(
        "advance picks: " + p.advance.map((x) => `${x.round}:${x.teamId}`).join(", "),
        "actual advancers: " + a.advance.map((x) => `${x.round}:${x.teamId}`).join(", "),
        "finalized rounds: " + a.advanceFinalized.join(","),
      );
      break;
    case "CHAMPION":
    case "RUNNERUP":
    case "THIRD_PLACE":
      lines.push(
        "final pick: " + JSON.stringify(p.final),
        "actual final: " + JSON.stringify(a.final),
      );
      break;
    default:
      lines.push("player picks: " + JSON.stringify(p));
  }
  return lines.join("\n");
}

/** Grade one seed's scenario both ways; return every disagreement found. */
export function runFuzzCase(seed: number, players = 12): FuzzFailure[] {
  const scenario = generateScenario(seed, players);
  const matchesById = new Map(scenario.matches.map((m) => [m.id, m]));
  const failures: FuzzFailure[] = [];

  scenario.players.forEach((p, i) => {
    const engine = scoreParticipant(p, matchesById, scenario.actuals);
    const oracle = oracleScore(p, matchesById, scenario.actuals);
    const eng = bucketEngine(engine.lines);

    for (const cat of CATS) {
      if (eng.live[cat] !== oracle.live[cat]) {
        failures.push({ seed, playerIndex: i, category: cat, field: "live", expected: oracle.live[cat], got: eng.live[cat], repro: reproFor(scenario, i, cat) });
      }
      if (eng.locked[cat] !== oracle.locked[cat]) {
        failures.push({ seed, playerIndex: i, category: cat, field: "locked", expected: oracle.locked[cat], got: eng.locked[cat], repro: reproFor(scenario, i, cat) });
      }
    }
    // totals (guards against a category the buckets miss) + the ceiling
    if (engine.livePoints !== oracle.totalLive) {
      failures.push({ seed, playerIndex: i, category: "TOTAL", field: "live", expected: oracle.totalLive, got: engine.livePoints, repro: reproFor(scenario, i, "TOTAL") });
    }
    if (engine.lockedPoints !== oracle.totalLocked) {
      failures.push({ seed, playerIndex: i, category: "TOTAL", field: "locked", expected: oracle.totalLocked, got: engine.lockedPoints, repro: reproFor(scenario, i, "TOTAL") });
    }
    if (engine.maxPossible !== oracle.maxPossible) {
      failures.push({ seed, playerIndex: i, category: "MAX", field: "max", expected: oracle.maxPossible, got: engine.maxPossible, repro: reproFor(scenario, i, "MAX") });
    }
  });

  return failures;
}

// ---------------------------------------------------------------------------
// Run many seeds (the "learning loop"). Always re-checks REGRESSION_SEEDS so a
// once-fixed bug can never silently come back.
// ---------------------------------------------------------------------------

/** Seeds that once exposed a real bug. After fixing the engine, add the seed
 *  here so this exact case is verified on every run, forever. */
export const REGRESSION_SEEDS: number[] = [];

export interface FuzzReport {
  iterations: number; // total seeds checked (including regression seeds)
  passed: number;
  failed: number;
  ok: boolean;
  firstFailure: FuzzFailure | null;
  byCategory: Record<string, number>; // failures grouped by category
  failingSeeds: number[]; // up to a handful, for adding to REGRESSION_SEEDS
}

// ---------------------------------------------------------------------------
// Meta-test: prove the checker actually has teeth. We take the real engine's
// result for each player, deliberately add 1 point to it (a planted "bug"), and
// run it through the same comparison. If the checker is real it flags EVERY
// planted error; if it were rigged to always say "pass", it would flag none.
// ---------------------------------------------------------------------------
export interface SanityReport {
  scenarios: number;
  planted: number; // gradings we deliberately corrupted (+1 pt each)
  caught: number; // how many the checker flagged
  ok: boolean; // caught === planted (detector works)
  sample: { seed: number; player: number; clean: number; tampered: number } | null;
}

export function runSanityCheck(iterations = 300, baseSeed = 7, players = 12): SanityReport {
  let planted = 0;
  let caught = 0;
  let sample: SanityReport["sample"] = null;

  for (let i = 0; i < iterations; i++) {
    const seed = ((baseSeed >>> 0) + i * 0x9e3779b1) >>> 0;
    const scenario = generateScenario(seed, players);
    const matchesById = new Map(scenario.matches.map((m) => [m.id, m]));
    scenario.players.forEach((p, pi) => {
      const engine = scoreParticipant(p, matchesById, scenario.actuals);
      const oracle = oracleScore(p, matchesById, scenario.actuals);
      const tampered = engine.livePoints + 1; // plant a 1-point grading error
      planted++;
      if (tampered !== oracle.totalLive) {
        caught++;
        if (!sample) sample = { seed, player: pi, clean: engine.livePoints, tampered };
      }
    });
  }
  return { scenarios: iterations, planted, caught, ok: caught === planted && planted > 0, sample };
}

export function runFuzz(iterations: number, baseSeed: number, players = 12): FuzzReport {
  const byCategory: Record<string, number> = {};
  const failingSeeds: number[] = [];
  let firstFailure: FuzzFailure | null = null;
  let failed = 0;

  const seeds = [
    ...REGRESSION_SEEDS,
    ...Array.from({ length: iterations }, (_, i) => ((baseSeed >>> 0) + i * 0x9e3779b1) >>> 0),
  ];

  for (const seed of seeds) {
    const fails = runFuzzCase(seed, players);
    if (fails.length) {
      failed++;
      if (!firstFailure) firstFailure = fails[0];
      if (failingSeeds.length < 5 && !failingSeeds.includes(seed)) failingSeeds.push(seed);
      for (const f of fails) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    }
  }

  const total = seeds.length;
  return {
    iterations: total,
    passed: total - failed,
    failed,
    ok: failed === 0,
    firstFailure,
    byCategory,
    failingSeeds,
  };
}
