import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveResult } from "@/lib/actions";
import { stageLabel, formatKickoff } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  await requireAdmin();
  const matches = await prisma.match.findMany({
    include: {
      homeTeam: { select: { id: true, name: true, flag: true } },
      awayTeam: { select: { id: true, name: true, flag: true } },
    },
    orderBy: [{ stage: "asc" }, { group: "asc" }, { kickoff: "asc" }],
  });

  // group by stage+group for headings
  const sections = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = stageLabel(m.stage, m.group);
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(m);
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink">Results</h1>
      <p className="mb-6 text-sm text-mut">
        Set a score and mark <b className="text-ink">Live</b> or{" "}
        <b className="text-ink">Final</b>. Saving recomputes all scores instantly.
        For knockouts decided on penalties, pick the winner.
      </p>

      <div className="space-y-7">
        {[...sections.entries()].map(([title, ms]) => (
          <section key={title}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-lime">
              {title}
            </h2>
            <div className="space-y-2">
              {ms.map((m) => {
                const knockout = m.stage !== "GROUP";
                return (
                  <form
                    key={m.id}
                    action={saveResult}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2"
                  >
                    <input type="hidden" name="matchId" value={m.id} />
                    <span className="hidden w-28 shrink-0 font-mono text-[10px] text-dim sm:block">
                      {formatKickoff(m.kickoff)}
                    </span>
                    <span className="flex flex-1 items-center justify-end gap-1 truncate text-right text-sm text-ink">
                      <span className="truncate">{m.homeTeam?.name ?? "TBD"}</span> {m.homeTeam?.flag}
                    </span>
                    <input
                      name="homeScore"
                      type="number"
                      min={0}
                      defaultValue={m.homeScore ?? ""}
                      className="tnum w-12 rounded-lg border border-line bg-bg px-2 py-1.5 text-center text-ink outline-none focus:border-lime"
                    />
                    <span className="text-dim">-</span>
                    <input
                      name="awayScore"
                      type="number"
                      min={0}
                      defaultValue={m.awayScore ?? ""}
                      className="tnum w-12 rounded-lg border border-line bg-bg px-2 py-1.5 text-center text-ink outline-none focus:border-lime"
                    />
                    <span className="flex flex-1 items-center gap-1 truncate text-sm text-ink">
                      {m.awayTeam?.flag} <span className="truncate">{m.awayTeam?.name ?? "TBD"}</span>
                    </span>
                    <select
                      name="status"
                      defaultValue={m.status}
                      className="rounded-lg border border-line bg-bg px-2 py-1.5 text-xs text-ink outline-none focus:border-lime"
                    >
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="LIVE">Live</option>
                      <option value="FINISHED">Final</option>
                    </select>
                    {knockout && (
                      <select
                        name="winnerTeamId"
                        defaultValue={m.winnerTeamId ?? ""}
                        className="rounded-lg border border-line bg-bg px-2 py-1.5 text-xs text-ink outline-none focus:border-lime"
                      >
                        <option value="">Winner…</option>
                        {m.homeTeam && <option value={m.homeTeam.id}>{m.homeTeam.name}</option>}
                        {m.awayTeam && <option value={m.awayTeam.id}>{m.awayTeam.name}</option>}
                      </select>
                    )}
                    <button className="rounded-lg bg-lime/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-lime">
                      Save
                    </button>
                  </form>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
