import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/queries";
import { Flag, ScoreCell, StatusBadge } from "@/components/ui";
import { formatKickoff, stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getMatchDetail(id);
  if (!detail) notFound();
  const { match: m, rows } = detail;
  const isGroup = m.stage === "GROUP";

  return (
    <div>
      <Link href="/matches" className="font-mono text-[11px] text-mut hover:text-lime">
        ← All matches
      </Link>

      {/* Match header */}
      <div className="mt-3 rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-5">
        <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-mut">
          <span>{stageLabel(m.stage, m.group)}</span>
          <StatusBadge status={m.status} />
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-1 flex-col items-center gap-1 text-center">
            <Flag flag={m.home?.flag ?? "🏳️"} className="text-4xl" />
            <span className="text-sm font-medium text-ink">{m.home?.name ?? "TBD"}</span>
          </div>
          <div className="px-2 text-center text-3xl">
            <ScoreCell m={m} />
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 text-center">
            <Flag flag={m.away?.flag ?? "🏳️"} className="text-4xl" />
            <span className="text-sm font-medium text-ink">{m.away?.name ?? "TBD"}</span>
          </div>
        </div>
        <div className="mt-3 text-center font-mono text-[11px] text-dim">
          {formatKickoff(m.kickoff)}
        </div>
      </div>

      {/* Who picked what */}
      <h2 className="mb-2 mt-7 font-display text-xl text-ink">
        Everyone&apos;s picks
      </h2>
      {!isGroup ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">
          Per-match scoreline picks apply to the group stage. Knockout points are
          awarded for correctly predicting which teams advance — see each player&apos;s
          bracket.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">
          No picks recorded for this match yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-line bg-panel px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-mut">
            <span>Player</span>
            <span className="text-center">Pick</span>
            <span className="text-right">Rank</span>
            <span className="text-right">Pts</span>
          </div>
          {rows.map((r) => {
            const exact =
              m.homeScore != null &&
              r.predHome === m.homeScore &&
              r.predAway === m.awayScore;
            return (
              <Link
                key={r.participantId}
                href={`/players/${r.slug}`}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-line/60 px-4 py-2.5 transition-colors last:border-0 hover:bg-panel2"
              >
                <span className="truncate text-sm text-ink">{r.name}</span>
                <span
                  className={`tnum rounded-md px-2 py-0.5 text-center text-sm ${
                    exact
                      ? "bg-lime/20 text-lime"
                      : r.points > 0
                        ? "bg-panel2 text-ink"
                        : "text-mut"
                  }`}
                >
                  {r.predHome}-{r.predAway}
                </span>
                <span className="tnum text-right text-xs text-dim">
                  {r.rank ? `#${r.rank}` : "–"}
                </span>
                <span
                  className={`tnum text-right text-sm font-bold ${
                    r.points > 0 ? "text-lime" : "text-dim"
                  }`}
                >
                  {r.points > 0 ? `+${r.points}` : "0"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
