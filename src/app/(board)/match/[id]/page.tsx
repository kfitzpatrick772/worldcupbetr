import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppState, getMatchDetail } from "@/lib/queries";
import { Flag, ScoreCell, StatusBadge } from "@/components/ui";
import { formatKickoff, stageLabel } from "@/lib/format";
import { outcomeOf } from "@/lib/scoring/engine";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, appState] = await Promise.all([getMatchDetail(id), getAppState()]);
  if (!detail) notFound();
  const { match: m, rows } = detail;
  const isGroup = m.stage === "GROUP";
  // Picks reveal the moment the admin locks them (no more edits).
  const revealed = appState.picksLocked;
  const hasResult =
    m.homeScore != null && m.awayScore != null && (m.status === "LIVE" || m.status === "FINISHED");
  const actual = hasResult ? outcomeOf(m.homeScore!, m.awayScore!) : null;

  return (
    <div>
      <Link href="/matches" className="font-mono text-xs text-mut hover:text-lime">
        ← All matches
      </Link>

      {/* Match header */}
      <div className="mt-3 rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-5">
        <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-mut">
          <span>{stageLabel(m.stage, m.group)}</span>
          <StatusBadge status={m.status} />
        </div>
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-1 flex-col items-center gap-1 text-center">
            <Flag flag={m.home?.flag ?? "🏟️"} className="text-4xl" />
            <span className={`text-sm font-semibold ${m.home ? "text-ink" : "text-dim"}`}>
              {m.home?.name ?? m.homeSource ?? "TBD"}
            </span>
          </div>
          <div className="px-2 text-center text-3xl">
            <ScoreCell m={m} />
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 text-center">
            <Flag flag={m.away?.flag ?? "🏟️"} className="text-4xl" />
            <span className={`text-sm font-semibold ${m.away ? "text-ink" : "text-dim"}`}>
              {m.away?.name ?? m.awaySource ?? "TBD"}
            </span>
          </div>
        </div>
        <div className="mt-3 text-center font-mono text-xs text-mut">
          {formatKickoff(m.kickoff)} ET{m.venue ? ` · ${m.venue}` : ""}
        </div>
      </div>

      {/* Who picked what */}
      <h2 className="mb-2 mt-7 font-display text-2xl text-ink">Everyone&apos;s picks</h2>

      {!isGroup ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">
          Knockout points are for correctly predicting which teams advance — see each
          player&apos;s bracket on their profile.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">
          No picks recorded for this match yet.
        </p>
      ) : (
        <>
          {!revealed && (
            <p className="mb-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-gold">
              🔒 Everyone&apos;s picks are hidden until the admin locks them (at kickoff).
            </p>
          )}
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="grid grid-cols-[1fr_1.2fr_auto_auto_auto] gap-2 border-b border-line bg-panel px-3 py-2 font-mono text-xs uppercase tracking-wider text-mut">
              <span>Player</span>
              <span>Pick</span>
              <span className="w-12 text-center">Score</span>
              <span className="hidden w-9 text-right sm:block">Rank</span>
              <span className="w-10 text-right">Pts</span>
            </div>
            {rows.map((r) => {
              const winner =
                r.predHome > r.predAway ? m.home : r.predAway > r.predHome ? m.away : null;
              const pred = outcomeOf(r.predHome, r.predAway);
              const exact =
                hasResult && r.predHome === m.homeScore && r.predAway === m.awayScore;
              const resultCorrect = hasResult && actual === pred;
              // color: green if result correct, red if wrong, neutral if no result
              const tone = !hasResult
                ? "text-ink"
                : resultCorrect
                  ? "text-lime"
                  : "text-red";
              return (
                <Link
                  key={r.participantId}
                  href={`/players/${r.slug}`}
                  className="grid grid-cols-[1fr_1.2fr_auto_auto_auto] items-center gap-2 border-b border-line/60 px-3 py-3 transition-colors last:border-0 hover:bg-panel2"
                >
                  <span className="truncate text-sm font-medium text-ink">{r.name}</span>
                  {/* picks REDACTED server-side until reveal (not just CSS-blurred) */}
                  {revealed ? (
                    <span className={`flex items-center gap-1.5 truncate text-sm font-semibold ${tone}`}>
                      {hasResult && (
                        <span aria-hidden className="shrink-0">
                          {resultCorrect ? "✓" : "✗"}
                        </span>
                      )}
                      {winner && <Flag flag={winner.flag} className="shrink-0 text-base" />}
                      <span className="truncate">{winner ? winner.name : "Draw"}</span>
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <span className="sr-only">Pick hidden until kickoff</span>
                      <span className="h-3.5 w-20 rounded bg-mut/25 blur-[2px]" aria-hidden />
                    </span>
                  )}
                  {revealed ? (
                    <span
                      className={`tnum w-12 text-center text-sm font-bold ${tone} ${exact ? "underline decoration-2 underline-offset-2" : ""}`}
                    >
                      {r.predHome}-{r.predAway}
                    </span>
                  ) : (
                    <span className="tnum w-12 text-center text-mut blur-[2px]" aria-hidden>
                      ··
                    </span>
                  )}
                  <span className="tnum hidden w-9 text-right text-xs text-mut sm:block">
                    {r.rank ? `#${r.rank}` : "–"}
                  </span>
                  <span
                    className={`tnum w-10 text-right text-sm font-bold ${r.points > 0 ? "text-lime" : "text-dim"}`}
                  >
                    {r.points > 0 ? `+${r.points}` : "0"}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-dim">
            <span className="font-bold text-lime">✓</span> correct result ·{" "}
            <span className="font-bold text-red">✗</span> wrong · underlined score = exact (+2)
          </p>
        </>
      )}
    </div>
  );
}
