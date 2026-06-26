import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { regeneratePickToken } from "@/lib/actions";
import { CopyLink } from "@/components/CopyLink";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  await requireAdmin();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  const [players, r32WithTeams] = await Promise.all([
    prisma.participant.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { knockoutPicks: true } } },
    }),
    prisma.match.count({ where: { stage: "R32", NOT: { homeTeamId: null } } }),
  ]);
  const bracketReady = r32WithTeams > 0;

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink">Pick links</h1>
      <p className="mb-4 max-w-2xl text-sm text-mut">
        Each contestant gets a private link to fill out their own knockout bracket. Copy it and
        send it to them individually. They open it, confirm their name, pick every winner from the
        Round of 32 to the Final, and submit — their picks update here automatically.
      </p>

      {!bracketReady && (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          Heads up: the Round-of-32 matchups aren&apos;t set yet, so the links will show
          &ldquo;not ready&rdquo; until you assign the 32 teams on{" "}
          <a href="/admin/bracket" className="underline">Bracket</a> (Auto-fill R32).
        </div>
      )}

      {players.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">No players yet.</p>
      ) : (
        <div className="space-y-2">
          {players.map((p) => {
            const url = p.pickToken ? `${origin}/picks/${p.pickToken}` : null;
            const done = p._count.knockoutPicks;
            return (
              <div key={p.id} className="rounded-xl border border-line bg-panel p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{p.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                      done >= 32 ? "bg-lime/15 text-lime" : done > 0 ? "bg-panel2 text-mut" : "bg-panel2 text-dim"
                    }`}
                  >
                    {done > 0 ? `${done}/32 picked` : "not started"}
                  </span>
                </div>
                {url ? (
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-bg px-2.5 py-1.5 font-mono text-xs text-mut">
                      {url}
                    </code>
                    <CopyLink url={url} />
                    <form action={regeneratePickToken}>
                      <input type="hidden" name="participantId" value={p.id} />
                      <button
                        className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs text-dim hover:border-red/50 hover:text-red"
                        title="Make a new link and invalidate the old one"
                      >
                        Reset
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={regeneratePickToken} className="flex items-center gap-2">
                    <input type="hidden" name="participantId" value={p.id} />
                    <span className="text-xs text-dim">No link yet.</span>
                    <button className="rounded-lg bg-lime px-3 py-1.5 font-mono text-xs font-semibold text-black hover:opacity-90">
                      Generate link
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
