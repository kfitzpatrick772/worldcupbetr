import Link from "next/link";
import { getMatches } from "@/lib/queries";
import { Flag, LiveBadge, ScoreCell, StatusBadge } from "@/components/ui";
import { LiveMinute } from "@/components/LiveMinute";
import { ScrollToDay } from "@/components/ScrollToDay";
import { dayKey, formatDay, formatTimeET, stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = await getMatches();

  // group by calendar day (matches arrive sorted by kickoff ascending)
  const days = new Map<string, typeof matches>();
  for (const m of matches) {
    const k = dayKey(m.kickoff);
    if (!days.has(k)) days.set(k, []);
    days.get(k)!.push(m);
  }

  // Land on today's matches — or the next upcoming day if nothing is on today,
  // else the final day once the tournament is over. Day keys are YYYY-MM-DD
  // (Eastern), so string comparison is chronological.
  const dayEntries = [...days.entries()];
  const todayKey = dayKey(new Date());
  const targetKey =
    dayEntries.find(([k]) => k >= todayKey)?.[0] ?? dayEntries.at(-1)?.[0] ?? null;

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-ink sm:text-4xl">Matches</h1>
      {targetKey && <ScrollToDay targetId={`day-${targetKey}`} />}
      <div className="space-y-8">
        {dayEntries.map(([k, dayMatches]) => (
          <section key={k} id={`day-${k}`} className="scroll-mt-20">
            <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-lime">
              {formatDay(dayMatches[0].kickoff)}
              {k === todayKey && (
                <span className="rounded-full bg-lime px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-bg">
                  Today
                </span>
              )}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line">
              {dayMatches.map((m) => (
                <Link
                  key={m.id}
                  href={`/match/${m.id}`}
                  className="block border-b border-line/60 px-3 py-2.5 transition-colors last:border-0 hover:bg-panel2"
                >
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-dim">
                    <span>
                      {stageLabel(m.stage, m.group)} · {formatTimeET(m.kickoff)}
                    </span>
                    {m.status === "LIVE" ? (
                      <LiveBadge>
                        <LiveMinute kickoffMs={m.kickoff.getTime()} />
                      </LiveBadge>
                    ) : (
                      <StatusBadge status={m.status} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex flex-1 items-center justify-end gap-2 truncate text-right">
                      <span className={`truncate text-sm ${m.home ? "text-ink" : "text-dim"}`}>
                        {m.home?.name ?? m.homeSource ?? "TBD"}
                      </span>
                      {m.home && <Flag flag={m.home.flag} className="shrink-0 text-lg" />}
                    </span>
                    <span className="w-14 shrink-0 text-center text-sm">
                      <ScoreCell m={m} />
                    </span>
                    <span className="flex flex-1 items-center gap-2 truncate">
                      {m.away && <Flag flag={m.away.flag} className="shrink-0 text-lg" />}
                      <span className={`truncate text-sm ${m.away ? "text-ink" : "text-dim"}`}>
                        {m.away?.name ?? m.awaySource ?? "TBD"}
                      </span>
                    </span>
                  </div>
                  {m.venue && (
                    <div className="mt-1.5 truncate text-center font-mono text-[10px] text-dim">
                      {m.venue}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
