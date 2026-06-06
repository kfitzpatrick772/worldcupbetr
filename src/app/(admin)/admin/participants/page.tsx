import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createParticipant, deleteParticipant } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
  await requireAdmin();
  const players = await prisma.participant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { groupMatchPicks: true, groupStandingPicks: true, bestThirdPicks: true } },
      finalPick: { select: { id: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-ink">Players</h1>

      <form action={createParticipant} className="mb-6 flex gap-2">
        <input
          name="name"
          placeholder="Add a player by name"
          className="flex-1 rounded-xl border border-line bg-panel px-4 py-2.5 text-ink outline-none focus:border-lime"
        />
        <button className="rounded-xl bg-lime px-4 py-2.5 font-semibold text-black hover:opacity-90">
          Add
        </button>
      </form>

      {players.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">
          No players yet. Add everyone in the pool above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {players.map((p) => {
            const complete =
              p._count.groupStandingPicks >= 24 &&
              p._count.bestThirdPicks >= 8 &&
              !!p.finalPick;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{p.name}</div>
                  <div className="font-mono text-[10px] text-dim">
                    {p._count.groupMatchPicks} match · {p._count.groupStandingPicks} standings ·{" "}
                    {p._count.bestThirdPicks} thirds {p.finalPick ? "· final" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                      complete ? "bg-lime/15 text-lime" : "bg-panel2 text-mut"
                    }`}
                  >
                    {complete ? "Complete" : "Incomplete"}
                  </span>
                  <Link
                    href={`/admin/picks/${p.slug}`}
                    className="rounded-lg border border-line px-3 py-1 text-xs text-ink hover:bg-panel2"
                  >
                    Edit picks
                  </Link>
                  <form action={deleteParticipant}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="font-mono text-[11px] text-dim hover:text-red">Delete</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
