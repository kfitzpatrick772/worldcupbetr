import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/queries";
import { Movement } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPlayer(slug);
  if (!data) notFound();
  const { participant, byCategory } = data;
  const s = participant.standing;

  // keep rulebook-ish ordering
  const order = [
    "GROUP_MATCH",
    "GROUP_ADVANCE",
    "GROUP_WINNER_BONUS",
    "GROUP_RUNNERUP_BONUS",
    "BEST_THIRD",
    "ADVANCE_R16",
    "ADVANCE_QF",
    "ADVANCE_SF",
    "ADVANCE_FINAL",
    "THIRD_PLACE",
    "RUNNERUP",
    "CHAMPION",
  ];
  const cat = new Map(byCategory);
  const breakdown = order
    .filter((k) => cat.has(k))
    .map((k) => ({ key: k, label: CATEGORY_LABEL[k] ?? k, points: cat.get(k)! }));

  return (
    <div>
      <Link href="/" className="font-mono text-[11px] text-mut hover:text-lime">
        ← Leaderboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-lime">
            {s ? `Rank #${s.rank}` : "Player"}
          </div>
          <h1 className="mt-1 flex items-center gap-2 font-display text-4xl text-ink">
            {participant.name}
            {s && <Movement value={s.prevRank == null ? 0 : s.prevRank - s.rank} />}
          </h1>
        </div>
        <div className="text-right">
          <div className="tnum text-4xl font-bold text-lime">{s?.totalPoints ?? 0}</div>
          <div className="font-mono text-[11px] text-dim">
            max possible {s?.maxPossible ?? 0}
          </div>
        </div>
      </div>

      <h2 className="mb-2 mt-7 font-display text-xl text-ink">Points breakdown</h2>
      {breakdown.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">
          No points yet — the tournament is just getting started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {breakdown.map((b) => (
            <div
              key={b.key}
              className="flex items-center justify-between border-b border-line/60 px-4 py-3 last:border-0"
            >
              <span className="text-sm text-ink">{b.label}</span>
              <span className="tnum text-sm font-bold text-lime">+{b.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
