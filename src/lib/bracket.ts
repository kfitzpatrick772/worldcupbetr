// 2026 World Cup knockout bracket tree (from the official schedule, matches
// M73–M104). Used to (a) render the cascading phase-2 entry and (b) derive the
// scoring sets (AdvancePick + FinalPick) from per-slot winner picks.

export type Feeder = { slot: string; result: "W" | "L" };

export const R32_SLOTS = Array.from({ length: 16 }, (_, i) => `M${73 + i}`);
export const R16_SLOTS = Array.from({ length: 8 }, (_, i) => `M${89 + i}`);
export const QF_SLOTS = Array.from({ length: 4 }, (_, i) => `M${97 + i}`);
export const SF_SLOTS = ["M101", "M102"];
export const THIRD_SLOT = "M103";
export const FINAL_SLOT = "M104";

// Each non-R32 slot is fed by two earlier matches (winner, except 3rd = losers).
export const TREE: Record<string, [Feeder, Feeder]> = {
  M89: [{ slot: "M74", result: "W" }, { slot: "M77", result: "W" }],
  M90: [{ slot: "M73", result: "W" }, { slot: "M75", result: "W" }],
  M91: [{ slot: "M76", result: "W" }, { slot: "M78", result: "W" }],
  M92: [{ slot: "M79", result: "W" }, { slot: "M80", result: "W" }],
  M93: [{ slot: "M83", result: "W" }, { slot: "M84", result: "W" }],
  M94: [{ slot: "M81", result: "W" }, { slot: "M82", result: "W" }],
  M95: [{ slot: "M86", result: "W" }, { slot: "M88", result: "W" }],
  M96: [{ slot: "M85", result: "W" }, { slot: "M87", result: "W" }],
  M97: [{ slot: "M89", result: "W" }, { slot: "M90", result: "W" }],
  M98: [{ slot: "M93", result: "W" }, { slot: "M94", result: "W" }],
  M99: [{ slot: "M91", result: "W" }, { slot: "M92", result: "W" }],
  M100: [{ slot: "M95", result: "W" }, { slot: "M96", result: "W" }],
  M101: [{ slot: "M97", result: "W" }, { slot: "M98", result: "W" }],
  M102: [{ slot: "M99", result: "W" }, { slot: "M100", result: "W" }],
  M103: [{ slot: "M101", result: "L" }, { slot: "M102", result: "L" }],
  M104: [{ slot: "M101", result: "W" }, { slot: "M102", result: "W" }],
};

export type R32Teams = Record<string, { home: string | null; away: string | null }>;
export type Picks = Record<string, string | undefined>; // slot -> winner teamId

/** The two team ids contesting a slot, given the user's picks + actual R32 teams.
 *  Returns nulls where upstream picks aren't made yet. */
export function participantsOf(slot: string, picks: Picks, r32: R32Teams): [string | null, string | null] {
  if (R32_SLOTS.includes(slot)) {
    const t = r32[slot] ?? { home: null, away: null };
    return [t.home, t.away];
  }
  const [fa, fb] = TREE[slot];
  return [resolveFeeder(fa, picks, r32), resolveFeeder(fb, picks, r32)];
}

function resolveFeeder(f: Feeder, picks: Picks, r32: R32Teams): string | null {
  const winner = picks[f.slot] ?? null;
  if (f.result === "W") return winner;
  // loser = the participant of f.slot that isn't the picked winner
  const [a, b] = participantsOf(f.slot, picks, r32);
  if (!winner) return null;
  if (a && a !== winner) return a;
  if (b && b !== winner) return b;
  return null;
}

/** Derive scoring inputs from per-slot winner picks. */
export function deriveKnockoutScoring(picks: Picks) {
  const advance: { round: "R16" | "QF" | "SF" | "FINAL"; teamId: string }[] = [];
  const push = (round: "R16" | "QF" | "SF" | "FINAL", slots: string[]) => {
    for (const s of slots) {
      const t = picks[s];
      if (t) advance.push({ round, teamId: t });
    }
  };
  push("R16", R32_SLOTS); // winning a R32 match = reaching the R16
  push("QF", R16_SLOTS);
  push("SF", QF_SLOTS);
  push("FINAL", SF_SLOTS);

  const champion = picks[FINAL_SLOT] ?? null;
  const finalists = [picks.M101, picks.M102].filter(Boolean) as string[];
  const runnerUp = champion ? finalists.find((t) => t !== champion) ?? null : null;
  const thirdPlace = picks[THIRD_SLOT] ?? null;

  const final =
    champion && runnerUp && thirdPlace
      ? { championTeamId: champion, runnerUpTeamId: runnerUp, thirdPlaceTeamId: thirdPlace }
      : null;

  return { advance, final };
}

export function stageOfSlot(slot: string): string {
  if (R32_SLOTS.includes(slot)) return "R32";
  if (R16_SLOTS.includes(slot)) return "R16";
  if (QF_SLOTS.includes(slot)) return "QF";
  if (SF_SLOTS.includes(slot)) return "SF";
  if (slot === THIRD_SLOT) return "THIRD";
  return "FINAL";
}
