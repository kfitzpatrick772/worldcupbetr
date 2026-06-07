import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BracketEntry } from "@/components/BracketEntry";
import { R32_SLOTS } from "@/lib/bracket";

export const dynamic = "force-dynamic";

export default async function KnockoutEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; locked?: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const sp = await searchParams;

  const participant = await prisma.participant.findUnique({
    where: { slug },
    include: { knockoutPicks: true },
  });
  if (!participant) notFound();

  const [knockoutMatches, teamRows, state] = await Promise.all([
    prisma.match.findMany({
      where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] } },
      select: { slotLabel: true, homeTeamId: true, awayTeamId: true, homeSource: true, awaySource: true },
    }),
    prisma.team.findMany({ select: { id: true, name: true, flag: true } }),
    prisma.appState.findUnique({ where: { id: 1 } }),
  ]);

  const teams: Record<string, { name: string; flag: string }> = {};
  for (const t of teamRows) teams[t.id] = { name: t.name, flag: t.flag };

  const r32: Record<string, { home: string | null; away: string | null }> = {};
  const slotInfo: Record<string, { slotLabel: string; homeSource: string | null; awaySource: string | null }> = {};
  for (const m of knockoutMatches) {
    if (!m.slotLabel) continue;
    slotInfo[m.slotLabel] = { slotLabel: m.slotLabel, homeSource: m.homeSource, awaySource: m.awaySource };
    if (R32_SLOTS.includes(m.slotLabel)) {
      r32[m.slotLabel] = { home: m.homeTeamId, away: m.awayTeamId };
    }
  }
  const initial: Record<string, string> = {};
  for (const k of participant.knockoutPicks) initial[k.slotLabel] = k.teamId;

  const r32Ready = R32_SLOTS.some((s) => r32[s]?.home && r32[s]?.away);
  const locked = state?.knockoutLocked ?? false;

  return (
    <div>
      <Link href="/admin/knockout" className="font-mono text-[11px] text-mut hover:text-lime">
        ← All players
      </Link>
      <h1 className="mt-2 mb-1 font-display text-3xl text-ink">{participant.name} · knockout</h1>
      {sp.saved && (
        <div className="mb-4 rounded-lg border border-lime/40 bg-lime/10 px-4 py-2 text-sm text-lime">
          Saved &amp; scores recomputed.
        </div>
      )}
      {(sp.locked || locked) && (
        <div className="mb-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold">
          Knockout picks are locked. Unlock on the Dashboard to edit.
        </div>
      )}

      {!r32Ready ? (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          Assign the Round-of-32 teams first on{" "}
          <Link href="/admin/bracket" className="underline">Bracket</Link>. The winners you
          pick each round flow into the next automatically.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-mut">
            Tap the team you think wins each match — your picks cascade into the next round.
          </p>
          <BracketEntry
            r32={r32}
            slotInfo={slotInfo}
            teams={teams}
            initial={initial}
            participantId={participant.id}
            slug={slug}
            locked={locked}
          />
        </>
      )}
    </div>
  );
}
