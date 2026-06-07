import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppState, getPlayerProfile } from "@/lib/queries";
import { Flag, Movement } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, appState] = await Promise.all([getPlayerProfile(slug), getAppState()]);
  if (!data) notFound();
  const { participant, standing, stats, byGroup, categories, finalPick, bestThirds } = data;
  // Group picks reveal at the group lock; knockout/final picks at the knockout lock.
  const groupRevealed = appState.picksLocked;
  const koRevealed = appState.knockoutLocked;

  const cat = new Map(categories);
  const knockoutPts =
    (cat.get("ADVANCE_R16") ?? 0) +
    (cat.get("ADVANCE_QF") ?? 0) +
    (cat.get("ADVANCE_SF") ?? 0) +
    (cat.get("ADVANCE_FINAL") ?? 0) +
    (cat.get("CHAMPION") ?? 0) +
    (cat.get("RUNNERUP") ?? 0) +
    (cat.get("THIRD_PLACE") ?? 0);

  const order = [
    "GROUP_MATCH", "GROUP_ADVANCE", "GROUP_WINNER_BONUS", "GROUP_RUNNERUP_BONUS",
    "BEST_THIRD", "ADVANCE_R16", "ADVANCE_QF", "ADVANCE_SF", "ADVANCE_FINAL",
    "THIRD_PLACE", "RUNNERUP", "CHAMPION",
  ];
  const breakdown = order
    .filter((k) => cat.has(k))
    .map((k) => ({ key: k, label: CATEGORY_LABEL[k] ?? k, points: cat.get(k)! }));

  return (
    <div>
      <Link href="/" className="font-mono text-xs text-mut hover:text-lime">
        ← Leaderboard
      </Link>

      {/* Identity + dashboard bar */}
      <div className="mt-3 flex items-center gap-2">
        <h1 className="font-display text-4xl text-ink sm:text-5xl">{participant.name}</h1>
        {standing && <Movement value={standing.prevRank == null ? 0 : standing.prevRank - standing.rank} />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Points" value={standing?.totalPoints ?? 0} accent="lime" />
        <Stat label="Rank" value={standing ? `#${standing.rank}` : "—"} accent="gold" />
        <Stat
          label="Correct"
          value={stats.pct == null ? "—" : `${stats.pct}%`}
          sub={`${stats.correct}/${stats.decided} results`}
        />
        <Stat label="Max possible" value={standing?.maxPossible ?? 0} sub={`${stats.exact} exact`} />
      </div>

      {!groupRevealed && (
        <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-gold">
          🔒 Picks are hidden until the admin locks them (at kickoff).
        </p>
      )}

      {/* Per-group breakdown */}
      <h2 className="mb-3 mt-8 font-display text-2xl text-ink">By group</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {byGroup.map((g) => (
          <div key={g.group} className="rounded-2xl border border-line bg-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-lg text-ink">Group {g.group}</span>
              <span className="tnum text-sm">
                <span className="font-bold text-lime">{g.earned}</span>
                <span className="text-dim"> / {g.potential} pts</span>
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <PickRow label="1st" team={g.first} blurred={!groupRevealed} />
              <PickRow label="2nd" team={g.second} blurred={!groupRevealed} />
            </div>
            <div className="mt-2 border-t border-line/60 pt-2 font-mono text-xs text-mut">
              {g.decided > 0
                ? `${g.correct}/${g.decided} match results correct`
                : `${g.picks} scoreline picks · not started`}
            </div>
          </div>
        ))}
      </div>

      {/* Knockout & final */}
      <h2 className="mb-3 mt-8 font-display text-2xl text-ink">Knockout &amp; final</h2>
      <div className="rounded-2xl border border-line bg-panel p-4">
        {finalPick ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <FinalPick label="Champion" team={finalPick.championTeam} accent blurred={!koRevealed} />
            <FinalPick label="Runner-up" team={finalPick.runnerUpTeam} blurred={!koRevealed} />
            <FinalPick label="3rd place" team={finalPick.thirdPlaceTeam} blurred={!koRevealed} />
          </div>
        ) : (
          <p className="text-sm text-mut">Knockout bracket entered after the group stage.</p>
        )}
        <div className="mt-3 border-t border-line/60 pt-3 font-mono text-xs text-mut">
          Knockout points so far: <span className="font-bold text-lime">{knockoutPts}</span>
          {bestThirds.length > 0 && <> · {bestThirds.length} best-third picks</>}
        </div>
      </div>

      {/* Category breakdown (once points exist) */}
      {breakdown.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-display text-2xl text-ink">Points breakdown</h2>
          <div className="overflow-hidden rounded-2xl border border-line">
            {breakdown.map((b) => (
              <div
                key={b.key}
                className="flex items-center justify-between border-b border-line/60 px-4 py-2.5 last:border-0"
              >
                <span className="text-sm text-ink">{b.label}</span>
                <span className="tnum text-sm font-bold text-lime">+{b.points}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "lime" | "gold";
}) {
  return (
    <div className="rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-mut">{label}</div>
      <div
        className={`tnum mt-1 text-2xl font-bold ${
          accent === "gold" ? "text-gold" : accent === "lime" ? "text-lime" : "text-ink"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 font-mono text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

function PickRow({
  label,
  team,
  blurred,
}: {
  label: string;
  team: { name: string; flag: string } | null;
  blurred?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 font-mono text-xs text-dim">{label}</span>
      {!team ? (
        <span className="text-dim">—</span>
      ) : blurred ? (
        // redacted server-side until reveal (real pick not sent to the browser)
        <span className="flex items-center">
          <span className="sr-only">Hidden until kickoff</span>
          <span className="inline-block h-4 w-28 rounded bg-mut/25 blur-[2px]" aria-hidden />
        </span>
      ) : (
        <span className="flex items-center gap-2 text-ink">
          <Flag flag={team.flag} className="text-base" /> {team.name}
        </span>
      )}
    </div>
  );
}

function FinalPick({
  label,
  team,
  accent,
  blurred,
}: {
  label: string;
  team: { name: string; flag: string };
  accent?: boolean;
  blurred?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider text-mut">{label}</div>
      {blurred ? (
        <span className="mt-1 flex items-center">
          <span className="sr-only">Hidden until kickoff</span>
          <span className="inline-block h-4 w-24 rounded bg-mut/25 blur-[2px]" aria-hidden />
        </span>
      ) : (
        <div className={`mt-1 flex items-center gap-2 font-medium ${accent ? "text-gold" : "text-ink"}`}>
          <Flag flag={team.flag} className="text-lg" /> {team.name}
        </div>
      )}
    </div>
  );
}
