import { getGroupTables } from "@/lib/queries";
import { Flag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await getGroupTables();

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink sm:text-4xl">Groups</h1>
      <p className="mb-6 text-sm text-mut">
        Live tables. <span className="text-lime">●</span> top two advance ·{" "}
        <span className="text-blue">●</span> best-third qualifier.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.group} className="overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2">
              <span className="font-display text-lg text-ink">Group {g.group}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
                {g.complete ? "Final" : "In progress"}
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr_repeat(4,auto)] gap-x-2 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-mut">
              <span></span>
              <span></span>
              <span className="text-center">P</span>
              <span className="text-center">GD</span>
              <span className="text-center">Pts</span>
              <span></span>
            </div>
            {g.rows.map((r) => (
              <div
                key={r.teamId}
                className="grid grid-cols-[auto_1fr_repeat(4,auto)] items-center gap-x-2 border-t border-line/40 px-3 py-2"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    r.advancing ? "bg-lime" : r.bestThird ? "bg-blue" : "bg-transparent"
                  }`}
                />
                <span className="flex items-center gap-2 truncate">
                  <Flag flag={r.flag} className="text-base" />
                  <span className="truncate text-sm text-ink">{r.name}</span>
                </span>
                <span className="tnum text-center text-xs text-mut">{r.played}</span>
                <span className="tnum text-center text-xs text-mut">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </span>
                <span className="tnum text-center text-sm font-bold text-ink">{r.points}</span>
                <span className="w-4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
