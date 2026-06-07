import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { settleNow, toggleLock, toggleKnockoutLock } from "@/lib/actions";
import { formatKickoff } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();

  const [state, players, totalMatches, finished, lastRun, recentAudit] = await Promise.all([
    prisma.appState.findUnique({ where: { id: 1 } }),
    prisma.participant.count(),
    prisma.match.count(),
    prisma.match.count({ where: { status: "FINISHED" } }),
    prisma.settlementRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 8 }),
  ]);

  const warnings = (lastRun?.summary as { unresolvedKnockouts?: string[] } | null)?.unresolvedKnockouts ?? [];
  const locked = state?.picksLocked ?? false;
  const koLocked = state?.knockoutLocked ?? false;

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-ink">Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Players" value={players} />
        <Stat label="Matches done" value={`${finished}/${totalMatches}`} />
        <Stat label="Picks" value={locked ? "Locked" : "Open"} accent={locked ? "gold" : "lime"} />
        <Stat
          label="Last settled"
          value={state?.lastSettledAt ? "✓" : "—"}
        />
      </div>

      {warnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-red/40 bg-red/10 p-4 text-sm text-red">
          ⚠ {warnings.length} finished knockout match(es) have no winner set — points are
          paused for those until you set a winner on the Results tab.
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-display text-lg text-ink">Recompute scores</h2>
          <p className="mt-1 text-sm text-mut">
            Re-runs the scoring engine over all results &amp; picks. Safe to run
            anytime (idempotent).
          </p>
          <form action={settleNow} className="mt-3">
            <button className="rounded-xl bg-lime px-4 py-2 font-semibold text-black hover:opacity-90">
              Settle now
            </button>
          </form>
          {state?.lastSettledAt && (
            <p className="mt-2 font-mono text-[11px] text-dim">
              last: {formatKickoff(state.lastSettledAt)}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-display text-lg text-ink">
            Phase 1 · Group picks {locked ? "🔒" : ""}
          </h2>
          <p className="mt-1 text-sm text-mut">
            {locked
              ? "Group picks are locked. Unlock only to fix an entry error."
              : "Lock at the first kickoff (Jun 11) so group picks can't change once games start."}
          </p>
          <form action={toggleLock} className="mt-3">
            <button
              className={`rounded-xl px-4 py-2 font-semibold ${
                locked ? "border border-line text-ink hover:bg-panel2" : "bg-gold text-black hover:opacity-90"
              }`}
            >
              {locked ? "Unlock group picks" : "Lock group picks"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-display text-lg text-ink">
            Phase 2 · Knockout picks {koLocked ? "🔒" : ""}
          </h2>
          <p className="mt-1 text-sm text-mut">
            After the group stage, set the bracket on{" "}
            <Link href="/admin/bracket" className="text-lime">Bracket</Link>, enter each
            player&apos;s knockout picks, then lock at the Round-of-32 kickoff (Jun 28).
          </p>
          <form action={toggleKnockoutLock} className="mt-3">
            <button
              className={`rounded-xl px-4 py-2 font-semibold ${
                koLocked ? "border border-line text-ink hover:bg-panel2" : "bg-gold text-black hover:opacity-90"
              }`}
            >
              {koLocked ? "Unlock knockout picks" : "Lock knockout picks"}
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/participants" className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-panel2">
          Manage players →
        </Link>
        <Link href="/admin/picks" className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-panel2">
          Enter picks →
        </Link>
        <Link href="/admin/results" className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-panel2">
          Enter results →
        </Link>
        <Link href="/admin/bracket" className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-panel2">
          Set bracket →
        </Link>
        <Link href="/admin/knockout" className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-panel2">
          Enter knockout picks →
        </Link>
      </div>

      <h2 className="mb-2 mt-8 font-display text-lg text-ink">Recent activity</h2>
      <div className="overflow-hidden rounded-2xl border border-line">
        {recentAudit.length === 0 ? (
          <p className="p-4 text-sm text-mut">No activity yet.</p>
        ) : (
          recentAudit.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-line/60 px-4 py-2 text-sm last:border-0">
              <span className="text-ink">
                {a.action}
                {a.note ? <span className="text-mut"> · {a.note}</span> : null}
              </span>
              <span className="font-mono text-[11px] text-dim">{formatKickoff(a.at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "lime" | "gold";
}) {
  return (
    <div className="rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-mut">{label}</div>
      <div
        className={`tnum mt-1 text-2xl font-bold ${
          accent === "gold" ? "text-gold" : accent === "lime" ? "text-lime" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
