import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function KnockoutListPage() {
  await requireAdmin();
  const [players, r32WithTeams, state] = await Promise.all([
    prisma.participant.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { knockoutPicks: true } } },
    }),
    prisma.match.count({ where: { stage: "R32", NOT: { homeTeamId: null } } }),
    prisma.appState.findUnique({ where: { id: 1 } }),
  ]);
  const bracketReady = r32WithTeams > 0;

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink">Knockout picks</h1>
      <p className="mb-4 text-sm text-mut">
        Phase 2 — entered after the group stage. {state?.knockoutLocked && (
          <span className="text-gold">Locked.</span>
        )}
      </p>

      {!bracketReady && (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          The Round-of-32 matchups aren&apos;t set yet. Once the group stage ends, go to{" "}
          <Link href="/admin/bracket" className="underline">Bracket</Link> to assign the
          32 teams — then enter each player&apos;s picks here.
        </div>
      )}

      {players.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">No players yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/admin/knockout/${p.slug}`}
              className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 hover:bg-panel2"
            >
              <span className="font-medium text-ink">{p.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                  p._count.knockoutPicks >= 32 ? "bg-lime/15 text-lime" : "bg-panel2 text-mut"
                }`}
              >
                {p._count.knockoutPicks}/32
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
