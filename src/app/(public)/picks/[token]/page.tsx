import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getParticipantByPickToken, isContestantPicksLocked } from "@/lib/queries";
import { R32_SLOTS } from "@/lib/bracket";
import { PicksGate } from "@/components/PicksGate";

export const dynamic = "force-dynamic";

export default async function PicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; locked?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const participant = await getParticipantByPickToken(token);
  if (!participant) notFound();

  const [knockoutMatches, teamRows, picks, locked] = await Promise.all([
    prisma.match.findMany({
      where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] } },
      select: { slotLabel: true, homeTeamId: true, awayTeamId: true, homeSource: true, awaySource: true },
    }),
    prisma.team.findMany({ select: { id: true, name: true, flag: true } }),
    prisma.knockoutPick.findMany({ where: { participantId: participant.id } }),
    isContestantPicksLocked(),
  ]);

  const teams: Record<string, { name: string; flag: string }> = {};
  for (const t of teamRows) teams[t.id] = { name: t.name, flag: t.flag };

  const r32: Record<string, { home: string | null; away: string | null }> = {};
  const slotInfo: Record<string, { slotLabel: string; homeSource: string | null; awaySource: string | null }> = {};
  for (const m of knockoutMatches) {
    if (!m.slotLabel) continue;
    slotInfo[m.slotLabel] = { slotLabel: m.slotLabel, homeSource: m.homeSource, awaySource: m.awaySource };
    if (R32_SLOTS.includes(m.slotLabel)) r32[m.slotLabel] = { home: m.homeTeamId, away: m.awayTeamId };
  }
  const initial: Record<string, string> = {};
  for (const k of picks) initial[k.slotLabel] = k.teamId;

  const r32Ready = R32_SLOTS.some((s) => r32[s]?.home && r32[s]?.away);

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink sm:text-4xl">Your knockout bracket</h1>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-mut">{participant.name}</p>

      {sp.saved && (
        <div className="mb-4 rounded-lg border border-lime/40 bg-lime/10 px-4 py-2 text-sm text-lime">
          Picks submitted — you can reopen this link and change them until the round locks.
        </div>
      )}
      {(sp.locked || locked) && (
        <div className="mb-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold">
          Picks are locked — the knockout round has started. Your saved picks stand.
        </div>
      )}

      {!r32Ready ? (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          The Round-of-32 matchups aren&apos;t set yet. Check back once the group stage wraps up —
          this link will fill in with the real teams.
        </div>
      ) : (
        <PicksGate
          name={participant.name}
          token={token}
          locked={locked}
          r32={r32}
          slotInfo={slotInfo}
          teams={teams}
          initial={initial}
        />
      )}

      <p className="mt-8 text-center text-xs text-dim">
        <Link href="/" className="hover:text-lime">View the live leaderboard ↗</Link>
      </p>
    </div>
  );
}
