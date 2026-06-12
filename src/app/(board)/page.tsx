import Link from "next/link";
import {
  getAppState,
  getLeaderboard,
  getMatchday,
  getOpener,
  getParticipantCount,
  tournamentUnderway,
} from "@/lib/queries";
import type { MatchView } from "@/lib/queries";
import { Flag, LiveBadge, Movement, RankBadge, ScoreCell, StatusBadge } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { LiveMinute } from "@/components/LiveMinute";
import { AddToHomeScreen } from "@/components/AddToHomeScreen";
import { formatKickoff, formatTimeET, stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

const BUCKET_META = [
  { key: "group", short: "GRP", label: "Group matches" },
  { key: "advance", short: "ADV", label: "Group advancement" },
  { key: "thirds", short: "3RD", label: "Best thirds" },
  { key: "knockout", short: "KO", label: "Knockout rounds" },
  { key: "final", short: "FIN", label: "Final / champion" },
] as const;

export default async function LeaderboardPage() {
  const [leaderboard, appState, opener, playerCount, matchday] = await Promise.all([
    getLeaderboard(),
    getAppState(),
    getOpener(),
    getParticipantCount(),
    getMatchday(),
  ]);
  const lastSettledAt = appState.lastSettledAt;
  const before = !!opener && !tournamentUnderway(opener);
  const leaders = leaderboard.filter((r) => r.rank === 1);

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
              <div className="mb-6 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-panel p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">
                  {leaders.length > 1 ? "Tied for first" : "Current leader"}
                </div>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                  <div className="font-display text-4xl text-gold sm:text-5xl">
                    {leaders.map((l) => l.name).join(" · ")}
                  </div>
                  <div className="tnum text-3xl font-bold text-ink">
                    {leaderboard[0].points}
                    <span className="ml-1 text-sm font-normal text-mut">pts</span>
                  </div>
                </div>
              </div>
            </>
          )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-line">
        {/* header — bucket columns appear on sm+; mobile shows chips per row */}
        <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 font-mono text-xs uppercase tracking-wider text-mut">
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
            className="flex items-start gap-2 border-b border-line/60 px-3 py-3 transition-colors last:border-0 hover:bg-panel2 sm:items-center"
          >
            <span className="w-7 shrink-0">
              <RankBadge rank={r.rank} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-semibold text-ink">{r.name}</span>
                <Movement value={r.movement} />
              </span>
              {/* mobile: every metric in a labeled grid (desktop uses the columns at right) */}
              <span className="mt-2 grid grid-cols-3 gap-1.5 sm:hidden">
                {BUCKET_META.map((b) => (
                  <MetricCell key={b.key} label={b.short} value={r.buckets[b.key]} />
                ))}
                <MetricCell label="MAX" value={r.maxPossible} muted />
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
            <span className="tnum w-12 shrink-0 text-right text-lg font-bold text-lime">{r.points}</span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-dim">
        GRP group · ADV advance · 3RD thirds · KO knockout · FIN final · Max = highest still reachable
      </p>
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

function MetricCell({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <span className="flex items-center justify-between gap-1 rounded-lg bg-panel2 px-2 py-1">
      <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-mut">{label}</span>
      <span
        className={`tnum text-sm font-bold ${
          muted ? "text-mut" : value > 0 ? "text-ink" : "text-dim"
        }`}
      >
        {value}
      </span>
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
