import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { advanceKnockoutWinners, assignKnockoutTeams, autofillR32 } from "@/lib/actions";
import { stageLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
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

  const assigned = r32.filter((m) => m.homeTeam && m.awayTeam).length;

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink">Bracket</h1>
      <p className="mb-4 text-sm text-mut">
        After the group stage, set the 32 Round-of-32 teams here. Winners/runners-up
        (1A/2B…) can be auto-filled from results; assign the 8 third-place teams by hand.
        Later rounds fill in as results come in.
      </p>

      {sp.saved && (
        <div className="mb-4 rounded-lg border border-lime/40 bg-lime/10 px-4 py-2 text-sm text-lime">
          Saved <b>{sp.saved}</b>. ✓
        </div>
      )}

      <form action={autofillR32} className="mb-5">
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

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-lime">Round of 32</h2>
        <span className="font-mono text-[11px] text-mut">
          <b className={assigned === 16 ? "text-lime" : "text-ink"}>{assigned}</b>/16 set
        </span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {r32.map((m) => {
          const complete = !!(m.homeTeam && m.awayTeam);
          return (
            <form
              key={m.id}
              id={m.slotLabel ?? undefined}
              action={assignKnockoutTeams}
              className={`scroll-mt-20 rounded-xl border p-3 ${
                complete ? "border-line bg-panel" : "border-gold/45 bg-gold/[0.06]"
              }`}
            >
              <input type="hidden" name="matchId" value={m.id} />
              <input type="hidden" name="slot" value={m.slotLabel ?? ""} />
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-dim">
                <span>{m.slotLabel}</span>
                {!complete && <span className="font-semibold text-gold">needs team{m.homeTeam || m.awayTeam ? "" : "s"}</span>}
              </div>
              <label className="mb-2 block">
                <span className="mb-1 block font-mono text-[10px] text-dim">Home · {m.homeSource}</span>
                <Select name="homeTeamId" def={m.homeTeam?.id} />
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block font-mono text-[10px] text-dim">Away · {m.awaySource}</span>
                <Select name="awayTeamId" def={m.awayTeam?.id} />
              </label>
              <button className="w-full rounded-lg bg-lime py-2 text-sm font-semibold text-black hover:opacity-90">
                Save {m.slotLabel}
              </button>
            </form>
          );
        })}
      </div>

      <div className="mb-2 mt-7 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-mut">
          Later rounds (auto-advance from results)
        </h2>
        <form action={advanceKnockoutWinners}>
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-mut hover:border-lime hover:text-lime">
            Advance winners now
          </button>
        </form>
      </div>
      <p className="mb-3 text-xs text-dim">
        Winners flow into the next round automatically as results come in — use the button
        to fill them immediately.
      </p>
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
