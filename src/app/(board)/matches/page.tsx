import Link from "next/link";
import { getMatches } from "@/lib/queries";
import { Flag, ScoreCell, StatusBadge } from "@/components/ui";
import { dayKey, formatDay, formatTimeET, stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = await getMatches();

  // group by calendar day
  const days = new Map<string, typeof matches>();
  for (const m of matches) {
    const k = dayKey(m.kickoff);
    if (!days.has(k)) days.set(k, []);
    days.get(k)!.push(m);
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-ink sm:text-4xl">Matches</h1>
      <div className="space-y-8">
        {[...days.entries()].map(([k, dayMatches]) => (
          <section key={k}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-lime">
              {formatDay(dayMatches[0].kickoff)}
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
                    <StatusBadge status={m.status} />
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
