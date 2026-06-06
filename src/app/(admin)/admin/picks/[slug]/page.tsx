import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { savePicks } from "@/lib/actions";

export const dynamic = "force-dynamic";

type Team = { id: string; name: string; flag: string; group: string; code: string };

function TeamSelect({
  name,
  teams,
  defaultValue,
  placeholder,
}: {
  name: string;
  teams: Team[];
  defaultValue?: string;
  placeholder: string;
}) {
  const groups = [...new Set(teams.map((t) => t.group))].sort();
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-lime"
    >
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g} label={`Group ${g}`}>
          {teams
            .filter((t) => t.group === g)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function CheckGrid({ name, teams, checked }: { name: string; teams: Team[]; checked: Set<string> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 md:grid-cols-4">
      {teams.map((t) => (
        <label key={t.id} className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name={name} value={t.id} defaultChecked={checked.has(t.id)} className="accent-lime" />
          <span className="truncate">
            {t.flag} {t.name}
          </span>
        </label>
      ))}
    </div>
  );
}

export default async function PickEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; locked?: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const sp = await searchParams;

  const participant = await prisma.participant.findUnique({
    where: { slug },
    include: {
      groupStandingPicks: true,
      groupMatchPicks: true,
      bestThirdPicks: true,
      advancePicks: true,
      finalPick: true,
    },
  });
  if (!participant) notFound();

  const [teams, matches, state] = await Promise.all([
    prisma.team.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }] }),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      include: {
        homeTeam: { select: { name: true, flag: true } },
        awayTeam: { select: { name: true, flag: true } },
      },
      orderBy: [{ group: "asc" }, { kickoff: "asc" }],
    }),
    prisma.appState.findUnique({ where: { id: 1 } }),
  ]);

  const teamsByGroup = new Map<string, Team[]>();
  for (const t of teams) {
    if (!teamsByGroup.has(t.group)) teamsByGroup.set(t.group, []);
    teamsByGroup.get(t.group)!.push(t);
  }
  const groups = [...teamsByGroup.keys()].sort();

  const standing = new Map(participant.groupStandingPicks.map((s) => [`${s.group}_${s.position}`, s.teamId]));
  const mPick = new Map(participant.groupMatchPicks.map((m) => [m.matchId, m]));
  const thirdSet = new Set(participant.bestThirdPicks.map((b) => b.teamId));
  const advSet = (round: string) =>
    new Set(participant.advancePicks.filter((a) => a.round === round).map((a) => a.teamId));
  const fp = participant.finalPick;
  const locked = state?.picksLocked ?? false;

  return (
    <div>
      <Link href="/admin/picks" className="font-mono text-[11px] text-mut hover:text-lime">
        ← All players
      </Link>
      <h1 className="mt-2 mb-1 font-display text-3xl text-ink">{participant.name}&apos;s picks</h1>

      {sp.saved && (
        <div className="mb-4 rounded-lg border border-lime/40 bg-lime/10 px-4 py-2 text-sm text-lime">
          Saved & scores recomputed.
        </div>
      )}
      {(sp.locked || locked) && (
        <div className="mb-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold">
          Picks are locked. Unlock on the Dashboard to edit.
        </div>
      )}

      <form action={savePicks} className="space-y-8 pb-24">
        <input type="hidden" name="participantId" value={participant.id} />
        <input type="hidden" name="slug" value={slug} />

        {/* Group stage */}
        <section>
          <h2 className="mb-3 font-display text-xl text-ink">Group stage</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((g) => {
              const gTeams = teamsByGroup.get(g)!;
              const gMatches = matches.filter((m) => m.group === g);
              return (
                <div key={g} className="rounded-2xl border border-line bg-panel p-4">
                  <div className="mb-2 font-display text-lg text-ink">Group {g}</div>
                  {/* scorelines */}
                  <div className="space-y-1.5">
                    {gMatches.map((m) => {
                      const pick = mPick.get(m.id);
                      return (
                        <div key={m.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 truncate text-right text-ink">
                            {m.homeTeam?.name} {m.homeTeam?.flag}
                          </span>
                          <input
                            name={`m_${m.id}_h`}
                            type="number"
                            min={0}
                            defaultValue={pick?.predHome ?? ""}
                            className="tnum w-10 rounded border border-line bg-bg px-1 py-1 text-center text-ink outline-none focus:border-lime"
                          />
                          <span className="text-dim">-</span>
                          <input
                            name={`m_${m.id}_a`}
                            type="number"
                            min={0}
                            defaultValue={pick?.predAway ?? ""}
                            className="tnum w-10 rounded border border-line bg-bg px-1 py-1 text-center text-ink outline-none focus:border-lime"
                          />
                          <span className="flex-1 truncate text-ink">
                            {m.awayTeam?.flag} {m.awayTeam?.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* standings */}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-3">
                    <label className="text-xs text-mut">
                      Winner
                      <TeamSelect name={`g_${g}_1`} teams={gTeams} defaultValue={standing.get(`${g}_1`)} placeholder="1st…" />
                    </label>
                    <label className="text-xs text-mut">
                      Runner-up
                      <TeamSelect name={`g_${g}_2`} teams={gTeams} defaultValue={standing.get(`${g}_2`)} placeholder="2nd…" />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Best thirds */}
        <section className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="mb-1 font-display text-xl text-ink">Best third-place teams</h2>
          <p className="mb-3 text-xs text-mut">Pick the 8 third-placed teams you think qualify (5 pts each).</p>
          <CheckGrid name="third" teams={teams} checked={thirdSet} />
        </section>

        {/* Final */}
        <section className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="mb-3 font-display text-xl text-ink">Final</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-mut">
              Champion (160)
              <TeamSelect name="champion" teams={teams} defaultValue={fp?.championTeamId} placeholder="Champion…" />
            </label>
            <label className="text-xs text-mut">
              Runner-up (40)
              <TeamSelect name="runnerUp" teams={teams} defaultValue={fp?.runnerUpTeamId} placeholder="Runner-up…" />
            </label>
            <label className="text-xs text-mut">
              3rd-place winner (40)
              <TeamSelect name="thirdPlace" teams={teams} defaultValue={fp?.thirdPlaceTeamId} placeholder="Third…" />
            </label>
          </div>
        </section>

        {/* Knockout advancers */}
        <details className="rounded-2xl border border-line bg-panel p-4">
          <summary className="cursor-pointer font-display text-xl text-ink">
            Knockout bracket (advancers)
          </summary>
          <p className="mt-1 mb-4 text-xs text-mut">
            Tick the teams you predict to <b>reach</b> each round. Due before the Round of 32.
          </p>
          {[
            { round: "R16", label: "Reach Round of 16 — pick 16 (10 pts each)" },
            { round: "QF", label: "Reach Quarter-finals — pick 8 (20 pts each)" },
            { round: "SF", label: "Reach Semi-finals — pick 4 (40 pts each)" },
            { round: "FINAL", label: "Reach the Final — pick 2 (80 pts each)" },
          ].map((r) => (
            <div key={r.round} className="mb-4">
              <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-lime">{r.label}</div>
              <CheckGrid name={`adv_${r.round}`} teams={teams} checked={advSet(r.round)} />
            </div>
          ))}
        </details>

        {/* Sticky save */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className="font-mono text-[11px] text-dim">{participant.name}</span>
            <button
              disabled={locked}
              className="rounded-xl bg-lime px-6 py-2.5 font-semibold text-black hover:opacity-90 disabled:opacity-40"
            >
              Save picks
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
