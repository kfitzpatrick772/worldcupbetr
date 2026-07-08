import Link from "next/link";
import type { PathToTrophy, PathRowView, PathStatus } from "@/lib/queries";
import { RankBadge } from "./ui";

const BADGE: Record<PathStatus, { label: string; cls: string }> = {
  clinched: { label: "Clinched", cls: "bg-gold/15 text-gold ring-gold/30" },
  in_control: { label: "In control", cls: "bg-lime/15 text-lime ring-lime/30" },
  contender: { label: "Contender", cls: "bg-blue/12 text-blue ring-blue/30" },
  long_shot: { label: "Long shot", cls: "bg-panel2 text-mut ring-line" },
  eliminated: { label: "Eliminated", cls: "bg-transparent text-dim ring-line" },
};

export function PathBadge({ status }: { status: PathStatus }) {
  const b = BADGE[status];
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${b.cls}`}>
      {b.label}
    </span>
  );
}

/* -------- Hero (sits on the leaderboard) -------- */
export function PathHero({ data }: { data: PathToTrophy }) {
  if (!data.started) return null;
  const contenders = data.players.filter((p) => !p.eliminated).slice(0, 3);
  if (contenders.length === 0) return null;
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-panel p-5">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
        🏆 Path to the Trophy
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-display text-2xl text-ink sm:text-3xl">
          {data.aliveCount} still {data.aliveCount === 1 ? "standing" : "alive"}
        </h2>
        <span className="font-mono text-[11px] text-mut">{data.stageLabel} · {data.remainingLabel}</span>
      </div>
      <div className="mt-3">
        {contenders.map((p, i) => (
          <div key={p.participantId} className="flex items-start gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0">
            <span className="shrink-0"><RankBadge rank={i + 1} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-ink">{p.name}</span>
                <PathBadge status={p.status} />
              </div>
              <p className="mt-0.5 text-[0.82rem] text-mut">{p.rooting}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="tnum text-lg font-bold text-ink">{p.locked}</div>
              <div className="font-mono text-[10px] text-dim">max {p.tightMax}</div>
            </div>
          </div>
        ))}
      </div>
      <Link href="/path" className="mt-2 block text-center font-mono text-xs text-gold hover:text-lime">
        See everyone&apos;s path →
      </Link>
    </div>
  );
}

/* -------- Full list (the /path tab) -------- */
function StakeChip({ s }: { s: PathRowView["stakes"][number] }) {
  const cls =
    s.status === "live" ? "border-gold/30 bg-gold/[0.08]"
      : s.status === "locked" ? "border-lime/30 bg-lime/10"
        : "border-line text-dim line-through decoration-red/60";
  const vcls = s.status === "live" ? "text-gold" : s.status === "locked" ? "text-lime" : "text-dim";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.78rem] ${cls}`}>
      {s.teamFlag && <span aria-hidden>{s.teamFlag}</span>}
      <span className="whitespace-nowrap">{s.teamName} · {s.label}</span>
      <span className={`font-mono text-[0.66rem] font-bold ${vcls}`}>{s.status === "locked" ? `✓${s.points}` : `+${s.points}`}</span>
    </span>
  );
}

function PathCard({ p, scale }: { p: PathRowView; scale: number }) {
  const lockPct = Math.round((p.locked / scale) * 100);
  const potPct = Math.max(0, Math.round(((p.tightMax - p.locked) / scale) * 100));
  return (
    <div className={`rounded-2xl border border-line bg-panel p-4 ${p.eliminated ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2.5">
        <span className="shrink-0"><RankBadge rank={p.rank ?? 0} /></span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-base font-bold text-ink">{p.name}</span>
          <PathBadge status={p.status} />
        </span>
        <span className={`tnum text-xl font-bold ${p.eliminated ? "text-dim" : "text-lime"}`}>{p.locked}</span>
      </div>

      {p.eliminated ? (
        <p className="mt-2 text-sm text-dim">{p.reason}</p>
      ) : (
        <>
          {/* Path to win leads the card */}
          <div className="mt-2">
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-gold">What must happen</div>
            {p.mustHappen.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {p.mustHappen.map((m, i) => (
                  <li key={i} className="relative pl-4 text-[0.9rem] text-ink before:absolute before:left-1 before:text-gold before:content-['\203A']">
                    {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[0.9rem] text-ink">{p.rooting}</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[0.72rem] text-dim">
            <span>ceiling <b className="tnum text-ink">{p.tightMax}</b></span>
            <span>{p.gapToLead >= 0 ? "lead" : "behind"} <b className="tnum text-ink">{p.gapToLead >= 0 ? `+${p.gapToLead}` : p.gapToLead}</b></span>
            {p.winShare != null && <span>win chance <b className="tnum text-gold">{Math.round(p.winShare * 100)}%</b></span>}
          </div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
            <span className="absolute left-0 top-0 h-full rounded-full bg-lime" style={{ width: `${lockPct}%` }} />
            <span
              className="absolute top-0 h-full"
              style={{ left: `${lockPct}%`, width: `${potPct}%`, background: "repeating-linear-gradient(45deg,rgba(247,201,72,.55),rgba(247,201,72,.55) 4px,transparent 4px,transparent 8px)" }}
            />
          </div>

          {p.stakes.some((s) => s.status === "live") && (
            <>
              <div className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim">Still at stake</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.stakes.filter((s) => s.status === "live").map((s, i) => <StakeChip key={i} s={s} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function PathList({ data }: { data: PathToTrophy }) {
  if (!data.started) {
    return (
      <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mut">
        The race opens once the knockouts kick off — check back after the first Round-of-32 results.
      </p>
    );
  }
  const scale = Math.max(1, ...data.players.map((p) => p.tightMax));
  return (
    <div className="space-y-2.5">
      {data.players.map((p) => <PathCard key={p.participantId} p={p} scale={scale} />)}
    </div>
  );
}
