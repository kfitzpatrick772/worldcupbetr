import Link from "next/link";
import { getAppState, getLeaderboard } from "@/lib/queries";
import { Movement, RankBadge } from "@/components/ui";
import { formatKickoff } from "@/lib/format";

export const dynamic = "force-dynamic";

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
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b border-line bg-panel px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-mut">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Max</span>
          <span className="text-right">Pts</span>
        </div>
        {leaderboard.map((r) => (
          <Link
            key={r.participantId}
            href={`/players/${r.slug}`}
            className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-line/60 px-4 py-3 transition-colors last:border-0 hover:bg-panel2"
          >
            <RankBadge rank={r.rank} />
            <span className="flex items-center gap-2 truncate">
              <span className="truncate font-medium text-ink">{r.name}</span>
              <Movement value={r.movement} />
            </span>
            <span className="tnum text-right text-xs text-dim">{r.maxPossible}</span>
            <span className="tnum text-right text-lg font-bold text-lime">{r.points}</span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center font-mono text-[11px] text-dim">
        Tap a player to see their full bracket · Max = highest still reachable
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
