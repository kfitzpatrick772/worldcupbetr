import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assignKnockoutTeams, autofillR32 } from "@/lib/actions";
import { stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  await requireAdmin();
  const [matches, teams, standingsCount] = await Promise.all([
    prisma.match.findMany({
      where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] } },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: { slotLabel: "asc" },
    }),
    prisma.team.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }] }),
    prisma.groupStandingActual.count(),
  ]);

  // numeric slot sort (M73..M104)
  const num = (s: string | null) => Number((s ?? "M0").slice(1));
  const r32 = matches.filter((m) => m.stage === "R32").sort((a, b) => num(a.slotLabel) - num(b.slotLabel));
  const later = matches.filter((m) => m.stage !== "R32").sort((a, b) => num(a.slotLabel) - num(b.slotLabel));
  const groups = [...new Set(teams.map((t) => t.group))].sort();

  function Select({ name, def }: { name: string; def?: string | null }) {
    return (
      <select
        name={name}
        defaultValue={def ?? ""}
        className="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-lime"
      >
        <option value="">— TBD —</option>
        {groups.map((g) => (
          <optgroup key={g} label={`Group ${g}`}>
            {teams.filter((t) => t.group === g).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink">Bracket</h1>
      <p className="mb-4 text-sm text-mut">
        After the group stage, set the 32 Round-of-32 teams here. Winners/runners-up
        (1A/2B…) can be auto-filled from results; assign the 8 third-place teams by hand
        (or let the score feed set them). Later rounds fill in as results come in.
      </p>

      <form action={autofillR32} className="mb-6">
        <button
          disabled={standingsCount === 0}
          className="rounded-xl bg-lime px-4 py-2 font-semibold text-black hover:opacity-90 disabled:opacity-40"
        >
          Auto-fill 1st/2nd place slots from group results
        </button>
        {standingsCount === 0 && (
          <span className="ml-3 font-mono text-[11px] text-dim">group standings not final yet</span>
        )}
      </form>

      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-lime">Round of 32</h2>
      <div className="space-y-2">
        {r32.map((m) => (
          <form
            key={m.id}
            action={assignKnockoutTeams}
            className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-xl border border-line bg-panel p-2"
          >
            <input type="hidden" name="matchId" value={m.id} />
            <span className="w-10 font-mono text-[10px] text-dim">{m.slotLabel}</span>
            <div>
              <div className="font-mono text-[9px] text-dim">{m.homeSource}</div>
              <Select name="homeTeamId" def={m.homeTeam?.id} />
            </div>
            <div>
              <div className="font-mono text-[9px] text-dim">{m.awaySource}</div>
              <Select name="awayTeamId" def={m.awayTeam?.id} />
            </div>
            <button className="rounded-lg bg-lime/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-lime">
              Save
            </button>
          </form>
        ))}
      </div>

      <h2 className="mb-2 mt-7 font-mono text-[11px] uppercase tracking-[0.25em] text-mut">
        Later rounds (auto-advance from results)
      </h2>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {later.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-lg border border-line/60 bg-panel px-3 py-2 text-sm">
            <span className="w-10 font-mono text-[10px] text-dim">{m.slotLabel}</span>
            <span className="text-mut">{stageLabel(m.stage, null)}:</span>
            <span className="text-ink">{m.homeTeam?.name ?? m.homeSource}</span>
            <span className="text-dim">v</span>
            <span className="text-ink">{m.awayTeam?.name ?? m.awaySource}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
