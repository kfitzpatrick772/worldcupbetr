import Link from "next/link";
import { getAppState, getLeaderboard } from "@/lib/queries";
import { Movement, RankBadge } from "@/components/ui";
import { formatKickoff } from "@/lib/format";

export const dynamic = "force-dynamic";

const BUCKET_META = [
  { key: "group", short: "GRP", label: "Group matches" },
  { key: "advance", short: "ADV", label: "Group advancement" },
  { key: "thirds", short: "3RD", label: "Best thirds" },
  { key: "knockout", short: "KO", label: "Knockout rounds" },
  { key: "final", short: "FIN", label: "Final / champion" },
] as const;

export default async function LeaderboardPage() {
  const [leaderboard, appState] = await Promise.all([
    getLeaderboard(),
    getAppState(),
  ]);
  const lastSettledAt = appState.lastSettledAt;

  if (leaderboard.length === 0) {
    return (
      <EmptyState />
    );
  }

  const top = leaderboard[0];
  const leaders = leaderboard.filter((r) => r.rank === 1);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Leaderboard</h1>
        {lastSettledAt && (
          <span className="font-mono text-[11px] text-dim">
            updated {formatKickoff(lastSettledAt)}
          </span>
        )}
      </div>

      {/* Leader hero */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-panel p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
          {leaders.length > 1 ? "Tied for first" : "Current leader"}
        </div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div className="font-display text-4xl text-gold sm:text-5xl">
            {leaders.map((l) => l.name).join(" · ")}
          </div>
          <div className="tnum text-3xl font-bold text-ink">
            {top.points}
            <span className="ml-1 text-sm font-normal text-mut">pts</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-line">
        {/* header — bucket columns appear on sm+; mobile shows chips per row */}
        <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mut">
          <span className="w-7">#</span>
          <span className="flex-1">Player</span>
          {BUCKET_META.map((b) => (
            <span key={b.key} className="hidden w-9 text-right sm:block" title={b.label}>
              {b.short}
            </span>
          ))}
          <span className="hidden w-10 text-right sm:block">Max</span>
          <span className="w-12 text-right">Pts</span>
        </div>
        {leaderboard.map((r) => (
          <Link
            key={r.participantId}
            href={`/players/${r.slug}`}
            className="flex items-center gap-2 border-b border-line/60 px-3 py-3 transition-colors last:border-0 hover:bg-panel2"
          >
            <span className="w-7 shrink-0">
              <RankBadge rank={r.rank} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium text-ink">{r.name}</span>
                <Movement value={r.movement} />
              </span>
              {/* mobile breakdown chips (non-zero) */}
              <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
                {BUCKET_META.filter((b) => r.buckets[b.key] > 0).map((b) => (
                  <span
                    key={b.key}
                    className="tnum rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-mut"
                  >
                    {b.short} {r.buckets[b.key]}
                  </span>
                ))}
              </span>
            </span>
            {BUCKET_META.map((b) => (
              <span
                key={b.key}
                className={`tnum hidden w-9 text-right text-sm sm:block ${
                  r.buckets[b.key] > 0 ? "text-ink" : "text-dim"
                }`}
              >
                {r.buckets[b.key]}
              </span>
            ))}
            <span className="tnum hidden w-10 text-right text-xs text-dim sm:block">
              {r.maxPossible}
            </span>
            <span className="tnum w-12 text-right text-lg font-bold text-lime">{r.points}</span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center font-mono text-[11px] text-dim">
        GRP group · ADV advance · 3RD thirds · KO knockout · FIN final · Max = highest still reachable
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-line bg-panel p-10 text-center">
      <h1 className="font-display text-3xl text-ink">Leaderboard</h1>
      <p className="mx-auto mt-3 max-w-sm text-mut">
        Picks are being entered. The board goes live when the tournament kicks
        off on <b className="text-ink">June 11</b>.
      </p>
    </div>
  );
}
