import Link from "next/link";
import {
  getAppState,
  getGroupStageProgress,
  getLeaderboard,
  getMatchday,
  getOpener,
  getParticipantCount,
  tournamentUnderway,
} from "@/lib/queries";
import type { LeaderRow, MatchView } from "@/lib/queries";
import {
  ExactCount,
  Flag,
  FormDots,
  LiveBadge,
  Movement,
  PickRate,
  RankBadge,
  ScoreCell,
  StatusBadge,
} from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { LiveMinute } from "@/components/LiveMinute";
import { AddToHomeScreen } from "@/components/AddToHomeScreen";
import { formatKickoff, formatTimeET, stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [leaderboard, appState, opener, playerCount, matchday, groupProgress] = await Promise.all([
    getLeaderboard(),
    getAppState(),
    getOpener(),
    getParticipantCount(),
    getMatchday(),
    getGroupStageProgress(),
  ]);
  const lastSettledAt = appState.lastSettledAt;
  const before = !!opener && !tournamentUnderway(opener);
  const leaders = leaderboard.filter((r) => r.rank === 1);
  // Stage-aware: surface the bonus breakdown only once some player has earned
  // non-group points (group advancement at group finalization, then knockout /
  // final bonuses). Before that it's pure group-match scoring.
  const bonusesEarned = leaderboard.some(
    (r) => r.buckets.advance + r.buckets.thirds + r.buckets.knockout + r.buckets.final > 0,
  );
  const leader = leaderboard[0];

  return (
    <div>
      {/* Pre-tournament: countdown up top, leaderboard still below it.
          Once underway: the countdown is replaced by today's live matches. */}
      {before && opener ? (
        <CountdownView opener={opener} playerCount={playerCount} />
      ) : (
        matchday && <MatchdayPanel matchday={matchday} />
      )}

      {leaderboard.length === 0 ? (
        before ? null : <EmptyState />
      ) : (
        <div className={before ? "mt-12" : "mt-10"}>
          {before ? (
            <h2 className="mb-4 font-display text-2xl text-ink">
              Players <span className="text-mut">· potential so far</span>
            </h2>
          ) : (
            <>
              <div className="mb-6 flex items-baseline justify-between">
                <h1 className="font-display text-3xl text-ink sm:text-4xl">Leaderboard</h1>
                {lastSettledAt && (
                  <span className="font-mono text-[11px] text-dim">
                    updated {formatKickoff(lastSettledAt)}
                  </span>
                )}
              </div>
              <div className="mb-4 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-panel p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">
                  {leaders.length > 1 ? "Tied for first" : "Current leader"}
                </div>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                  <div className="font-display text-4xl text-gold sm:text-5xl">
                    {leaders.map((l) => l.name).join(" · ")}
                  </div>
                  <div className="tnum text-3xl font-bold text-ink">
                    {leader.points}
                    <span className="ml-1 text-sm font-normal text-mut">pts</span>
                  </div>
                </div>
                {leaders.length === 1 && leader.stats.decided > 0 && (
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <LeaderStat k="Pick %" v={`${leader.stats.pct}%`} />
                    <LeaderStat k="Exact" v={`◎ ${leader.stats.exact}`} gold />
                    {leader.stats.streak >= 1 && <LeaderStat k="Streak" v={`W${leader.stats.streak}`} />}
                  </div>
                )}
              </div>
              {!groupProgress.complete && groupProgress.total > 0 && (
                <StageBar played={groupProgress.played} total={groupProgress.total} />
              )}
            </>
          )}

      {/* Table — skill metrics (Pick % / Exact / Form) on one line per player,
          with persistent column headers at every width. */}
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="grid items-center gap-1.5 border-b border-line bg-panel px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-mut sm:gap-2 sm:text-[11px] sm:tracking-wider grid-cols-[1.9rem_minmax(0,1fr)_2.9rem_2.1rem_3.6rem_2.6rem] sm:grid-cols-[2rem_minmax(0,1fr)_4.6rem_3rem_4.6rem_3rem_3.4rem]">
          <span className="whitespace-nowrap">#</span>
          <span className="whitespace-nowrap">Player</span>
          <span className="whitespace-nowrap">Pick %</span>
          <span className="whitespace-nowrap">Exact</span>
          <span className="whitespace-nowrap">Form</span>
          <span className="hidden whitespace-nowrap text-right sm:block">Max</span>
          <span className="whitespace-nowrap text-right">Pts</span>
        </div>
        {leaderboard.map((r) => (
          <Link
            key={r.participantId}
            href={`/players/${r.slug}`}
            className="grid items-center gap-1.5 border-b border-line/60 px-3 py-3 transition-colors last:border-0 hover:bg-panel2 sm:gap-2 grid-cols-[1.9rem_minmax(0,1fr)_2.9rem_2.1rem_3.6rem_2.6rem] sm:grid-cols-[2rem_minmax(0,1fr)_4.6rem_3rem_4.6rem_3rem_3.4rem]"
          >
            <span className="shrink-0">
              <RankBadge rank={r.rank} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-bold text-ink">{r.name}</span>
                <Movement value={r.movement} />
              </span>
              {bonusesEarned && <BonusChips buckets={r.buckets} />}
            </span>
            <PickRate pct={r.stats.pct} />
            <ExactCount value={r.stats.exact} />
            <FormDots form={r.stats.form} />
            <span className="tnum hidden text-right text-xs text-dim sm:block">{r.maxPossible}</span>
            <span className="tnum text-right text-lg font-bold text-lime">{r.points}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-mut">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-lime" /> Correct result
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-gold" /> Exact scoreline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-red" /> Wrong
        </span>
        <span className="text-dim">· Max = highest still reachable</span>
      </div>
      {!bonusesEarned && (
        <p className="mt-2 text-center font-mono text-[11px] text-dim">
          Advancement, knockout &amp; final bonuses appear here as they&apos;re earned
        </p>
      )}
        </div>
      )}

      <AddToHomeScreen />
    </div>
  );
}

function CountdownView({
  opener,
  playerCount,
}: {
  opener: MatchView;
  playerCount: number;
}) {
  return (
    <div className="py-6">
      <div className="mb-3 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.42em] text-lime">
        <span className="inline-block h-0.5 w-6 bg-lime" /> Kickoff
      </div>
      <h1 className="font-display text-4xl text-ink sm:text-6xl">
        The tournament
        <br />
        starts in
      </h1>

      <div className="mt-7">
        <Countdown targetMs={opener.kickoff.getTime()} />
      </div>

      {/* Opener matchup */}
      <div className="mt-7 rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-5">
        <div className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-mut">
          Opening match
        </div>
        <div className="flex items-center justify-center gap-4">
          <span className="flex flex-1 items-center justify-end gap-2 text-right">
            <span className="font-medium text-ink">{opener.home?.name ?? "TBD"}</span>
            {opener.home && <Flag flag={opener.home.flag} className="text-2xl" />}
          </span>
          <span className="font-mono text-xs text-dim">vs</span>
          <span className="flex flex-1 items-center gap-2">
            {opener.away && <Flag flag={opener.away.flag} className="text-2xl" />}
            <span className="font-medium text-ink">{opener.away?.name ?? "TBD"}</span>
          </span>
        </div>
        <div className="mt-3 text-center font-mono text-[11px] text-dim">
          {formatKickoff(opener.kickoff)} ET{opener.venue ? ` · ${opener.venue}` : ""}
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-mut">
        {playerCount > 0
          ? `${playerCount} players locked in — leaderboard goes live at kickoff.`
          : "Picks are being entered — leaderboard goes live at kickoff."}
      </p>
    </div>
  );
}

function MatchdayPanel({
  matchday,
}: {
  matchday: { kind: "today" | "next" | "last"; label: string; matches: MatchView[] };
}) {
  const anyLive = matchday.matches.some((m) => m.status === "LIVE");
  const heading =
    matchday.kind === "today"
      ? "Today's matches"
      : matchday.kind === "next"
        ? "Next matchday"
        : "Final day";
  return (
    <div className="pt-2">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-0.5 w-6 bg-lime" />
          <h2 className="font-display text-2xl text-ink sm:text-3xl">{heading}</h2>
        </div>
        {anyLive ? (
          <StatusBadge status="LIVE" />
        ) : (
          matchday.kind !== "today" && (
            <span className="font-mono text-[11px] uppercase tracking-wider text-mut">
              {matchday.label}
            </span>
          )
        )}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {matchday.matches.map((m) => (
          <MatchdayCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

function MatchdayCard({ m }: { m: MatchView }) {
  const live = m.status === "LIVE";
  return (
    <Link
      href={`/match/${m.id}`}
      className={`block rounded-2xl border p-3.5 transition-colors hover:bg-panel2 ${
        live ? "border-red/40 bg-red/5" : "border-line bg-panel"
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-mut">
        <span>{stageLabel(m.stage, m.group)}</span>
        {live ? (
          <LiveBadge>
            <LiveMinute kickoffMs={m.kickoff.getTime()} />
          </LiveBadge>
        ) : m.status === "FINISHED" ? (
          <StatusBadge status={m.status} />
        ) : (
          <span>{formatTimeET(m.kickoff)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Flag flag={m.home?.flag ?? "🏟️"} className="shrink-0 text-2xl" />
          <span className={`truncate text-sm font-semibold ${m.home ? "text-ink" : "text-dim"}`}>
            {m.home?.name ?? m.homeSource ?? "TBD"}
          </span>
        </span>
        <span className="shrink-0 px-1 text-center text-xl">
          <ScoreCell m={m} />
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <span className={`truncate text-sm font-semibold ${m.away ? "text-ink" : "text-dim"}`}>
            {m.away?.name ?? m.awaySource ?? "TBD"}
          </span>
          <Flag flag={m.away?.flag ?? "🏟️"} className="shrink-0 text-2xl" />
        </span>
      </div>
      {m.venue && (
        <div className="mt-2.5 truncate text-center font-mono text-[10px] text-dim">{m.venue}</div>
      )}
    </Link>
  );
}

function LeaderStat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.04] px-2.5 py-1">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-mut">{k}</span>
      <span className={`tnum text-sm font-bold ${gold ? "text-gold" : "text-lime"}`}>{v}</span>
    </span>
  );
}

function StageBar({ played, total }: { played: number; total: number }) {
  const pct = total ? Math.round((played / total) * 100) : 0;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-2.5">
      <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-lime">
        Group Stage
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-lime2 to-lime"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="shrink-0 whitespace-nowrap font-mono text-xs text-mut">
        <b className="text-ink">{played}</b> / {total} matches
      </span>
    </div>
  );
}

// Stage-aware: once knockout/advancement/final points exist, surface them as
// compact chips under the player's name (group points are already in Pts).
function BonusChips({ buckets }: { buckets: LeaderRow["buckets"] }) {
  const items = (
    [
      ["ADV", buckets.advance],
      ["3RD", buckets.thirds],
      ["KO", buckets.knockout],
      ["FIN", buckets.final],
    ] as const
  ).filter(([, v]) => v > 0);
  if (items.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {items.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-mut"
        >
          <span className="tracking-wide">{k}</span>
          <span className="tnum text-ink">{v}</span>
        </span>
      ))}
    </span>
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
