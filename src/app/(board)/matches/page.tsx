import Link from "next/link";
import { getMatches } from "@/lib/queries";
import { Flag, ScoreCell, StatusBadge } from "@/components/ui";
import { dayKey, formatDay, stageLabel } from "@/lib/format";

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
                  className="flex items-center gap-3 border-b border-line/60 px-4 py-3 transition-colors last:border-0 hover:bg-panel2"
                >
                  <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-dim">
                    {stageLabel(m.stage, m.group)}
                  </span>
                  <span className="flex flex-1 items-center justify-end gap-2 truncate text-right">
                    <span className="truncate text-sm text-ink">{m.home?.name ?? "TBD"}</span>
                    <Flag flag={m.home?.flag ?? "🏳️"} className="text-lg" />
                  </span>
                  <span className="w-16 shrink-0 text-center text-sm">
                    <ScoreCell m={m} />
                  </span>
                  <span className="flex flex-1 items-center gap-2 truncate">
                    <Flag flag={m.away?.flag ?? "🏳️"} className="text-lg" />
                    <span className="truncate text-sm text-ink">{m.away?.name ?? "TBD"}</span>
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    <StatusBadge status={m.status} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
