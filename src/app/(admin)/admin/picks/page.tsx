import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PicksListPage() {
  await requireAdmin();
  const players = await prisma.participant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { groupMatchPicks: true, groupStandingPicks: true, bestThirdPicks: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink">Enter picks</h1>
      <p className="mb-6 text-sm text-mut">
        Pick a player to enter or edit their bracket. Add players on the{" "}
        <Link href="/admin/participants" className="text-lime">Players</Link> tab.
      </p>

      {players.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">No players yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => {
            const complete =
              p._count.groupMatchPicks >= 72 &&
              p._count.groupStandingPicks >= 24 &&
              p._count.bestThirdPicks >= 8;
            return (
              <Link
                key={p.id}
                href={`/admin/picks/${p.slug}`}
                className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 hover:bg-panel2"
              >
                <span className="font-medium text-ink">{p.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                    complete ? "bg-lime/15 text-lime" : "bg-panel2 text-mut"
                  }`}
                >
                  {complete ? "Group stage complete" : `${p._count.groupMatchPicks}/72 matches`}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
