// Apply a provider's fixtures to our matches, then settle. Idempotent: only
// changed matches are written; running twice with the same feed is a no-op.

import { prisma } from "../db";
import { settle } from "../scoring/settle";
import { matchFixture, normalizeName } from "./match";
import type { FeedFixture, ScoreProvider } from "./types";

export interface SyncResult {
  fetched: number;
  matched: number;
  updated: number;
  unmatched: { ref: string; home: string; away: string }[];
  settled: boolean;
}

export async function applyFixtures(fixtures: FeedFixture[]): Promise<SyncResult> {
  const [ours, teams] = await Promise.all([
    prisma.match.findMany({
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);

  const teamByNorm = new Map(teams.map((t) => [normalizeName(t.name), t.id]));
  const indexable = ours.map((m) => ({
    id: m.id,
    externalRef: m.externalRef,
    homeName: m.homeTeam?.name ?? "",
    awayName: m.awayTeam?.name ?? "",
    kickoff: m.kickoff,
  }));
  const ourById = new Map(ours.map((m) => [m.id, m]));

  const unmatched: SyncResult["unmatched"] = [];
  let matched = 0;
  let updated = 0;

  for (const fx of fixtures) {
    const id = matchFixture(fx, indexable);
    if (!id) {
      unmatched.push({ ref: fx.externalRef, home: fx.homeName, away: fx.awayName });
      continue;
    }
    matched++;
    const cur = ourById.get(id)!;
    const winnerTeamId = fx.winnerName ? teamByNorm.get(normalizeName(fx.winnerName)) ?? null : null;

    const data: Record<string, unknown> = {};
    if (cur.externalRef !== fx.externalRef) data.externalRef = fx.externalRef;
    if (cur.status !== fx.status) data.status = fx.status;
    if (cur.homeScore !== fx.homeScore) data.homeScore = fx.homeScore;
    if (cur.awayScore !== fx.awayScore) data.awayScore = fx.awayScore;
    if (winnerTeamId && cur.winnerTeamId !== winnerTeamId) data.winnerTeamId = winnerTeamId;
    // Reconcile kickoff from the authoritative feed while still scheduled.
    if (fx.kickoff && cur.status === "SCHEDULED") {
      const k = new Date(fx.kickoff);
      if (!Number.isNaN(k.getTime()) && k.getTime() !== cur.kickoff.getTime()) data.kickoff = k;
    }

    if (Object.keys(data).length > 0) {
      await prisma.match.update({ where: { id }, data });
      updated++;
    }
  }

  let settled = false;
  if (updated > 0) {
    await settle("feed");
    settled = true;
  }

  return { fetched: fixtures.length, matched, updated, unmatched, settled };
}

export async function syncFromProvider(provider: ScoreProvider): Promise<SyncResult> {
  const fixtures = await provider.fetchFixtures();
  return applyFixtures(fixtures);
}
