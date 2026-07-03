// Persist advancing teams into the next round's slots as soon as a knockout
// match is decided (W74 → the actual winner). Runs after every result change
// (feed sync, admin result entry, manual button). Idempotent, and only fills
// EMPTY slots — never overwrites a team the admin set by hand.
//
// This is what makes the Round of 16+ populate everywhere (Matches, match
// pages, the bracket, contestant picks) and lets the score feed match the later
// rounds once their teams are known.

import { prisma } from "./db";
import { TREE } from "./bracket";

export async function propagateKnockoutWinners(): Promise<number> {
  const matches = await prisma.match.findMany({
    where: { slotLabel: { not: null }, stage: { not: "GROUP" } },
    select: {
      id: true, slotLabel: true, status: true,
      homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, winnerTeamId: true,
    },
  });
  const bySlot = new Map(matches.map((m) => [m.slotLabel!, m]));

  // The winner of a slot — explicit winnerTeamId (covers penalties), else the
  // higher score. null if not finished / undecided / teams unknown.
  const winnerOf = (slot: string): string | null => {
    const m = bySlot.get(slot);
    if (!m || m.status !== "FINISHED" || !m.homeTeamId || !m.awayTeamId) return null;
    if (m.winnerTeamId) return m.winnerTeamId;
    if (m.homeScore != null && m.awayScore != null && m.homeScore !== m.awayScore) {
      return m.homeScore > m.awayScore ? m.homeTeamId : m.awayTeamId;
    }
    return null;
  };
  const loserOf = (slot: string): string | null => {
    const m = bySlot.get(slot);
    const w = winnerOf(slot);
    if (!m || !w || !m.homeTeamId || !m.awayTeamId) return null;
    return w === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
  };
  const resolve = (f: { slot: string; result: "W" | "L" }) =>
    f.result === "W" ? winnerOf(f.slot) : loserOf(f.slot);

  // Bracket order (M89..M104) so a slot filled this pass can feed the next round
  // in the same pass if that later match is already played (catch-up).
  const order = Object.keys(TREE).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  let filled = 0;
  for (const slot of order) {
    const m = bySlot.get(slot);
    if (!m) continue;
    const [fa, fb] = TREE[slot];
    const data: { homeTeamId?: string; awayTeamId?: string } = {};
    if (!m.homeTeamId) {
      const t = resolve(fa);
      if (t) data.homeTeamId = t;
    }
    if (!m.awayTeamId) {
      const t = resolve(fb);
      if (t) data.awayTeamId = t;
    }
    if (data.homeTeamId || data.awayTeamId) {
      await prisma.match.update({ where: { id: m.id }, data });
      if (data.homeTeamId) m.homeTeamId = data.homeTeamId; // reflect for downstream this pass
      if (data.awayTeamId) m.awayTeamId = data.awayTeamId;
      filled++;
    }
  }
  return filled;
}
