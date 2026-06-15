import type { ReactNode } from "react";
import type { MatchView, FormResult } from "@/lib/queries";

// Hit-rate % with a thin progress bar beneath. Single-line per the v2
// leaderboard. null = no decided matches yet.
export function PickRate({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="tnum text-sm text-dim">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="tnum text-sm font-bold leading-none text-ink">{`${pct}%`}</span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-panel2">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-lime2 to-lime"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

// Count of exact scorelines nailed — the high-skill flex stat (gold).
export function ExactCount({ value }: { value: number }) {
  return (
    <span
      className={`tnum inline-flex items-center gap-1 text-sm font-bold ${
        value > 0 ? "text-gold" : "text-dim"
      }`}
    >
      <span aria-hidden>◎</span>
      {value}
    </span>
  );
}

// Recent form: up to 5 dots (lime=correct, gold ring=exact, red=wrong) plus a
// current-streak badge (hot lime at 2+, muted at 1).
export function FormDots({ form, streak }: { form: FormResult[]; streak: number }) {
  if (form.length === 0) return <span className="text-sm text-dim">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-1" aria-label="recent form">
        {form.map((r, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              r === "exact"
                ? "bg-gold ring-2 ring-inset ring-bg"
                : r === "hit"
                  ? "bg-lime"
                  : "bg-red"
            }`}
          />
        ))}
      </span>
      {streak >= 1 && (
        <span
          className={`tnum shrink-0 rounded px-1 text-[10px] font-bold ring-1 ring-inset ${
            streak >= 2 ? "bg-lime/15 text-lime ring-lime/25" : "text-dim ring-line"
          }`}
        >
          {`W${streak}`}
        </span>
      )}
    </span>
  );
}

// Movement arrow for leaderboard (positive = climbed since last settle).
export function Movement({ value }: { value: number }) {
  if (!value) return <span className="text-dim">–</span>;
  const up = value > 0;
  return (
    <span className={`tnum text-xs font-semibold ${up ? "text-lime" : "text-red"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(value)}
    </span>
  );
}

// Prominent live indicator: pinging dot + LIVE + (optionally) the match
// minute. Use wherever a live game is shown; StatusBadge stays for compact
// secondary contexts.
export function LiveBadge({ children }: { children?: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-red/50 bg-red/15 px-3 py-1 text-red"
      style={{ boxShadow: "0 0 14px color-mix(in srgb, var(--color-red) 40%, transparent)" }}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red" />
      </span>
      <span className="font-mono text-xs font-bold uppercase tracking-[0.18em]">Live</span>
      {children && <span className="tnum text-sm font-bold">{children}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "LIVE")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-red">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red" />
        Live
      </span>
    );
  if (status === "FINISHED")
    return (
      <span className="rounded-full bg-panel2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mut">
        Full-time
      </span>
    );
  return null;
}

export function Flag({ flag, className = "" }: { flag: string; className?: string }) {
  return (
    <span className={`select-none leading-none ${className}`} aria-hidden>
      {flag}
    </span>
  );
}

// Compact scoreline for a match (handles scheduled / live / finished).
export function ScoreCell({ m }: { m: MatchView }) {
  if (m.status === "SCHEDULED") {
    return <span className="tnum text-dim">vs</span>;
  }
  const live = m.status === "LIVE";
  return (
    <span className={`tnum font-semibold ${live ? "text-red" : "text-ink"}`}>
      {m.homeScore}
      <span className="mx-1 text-dim">-</span>
      {m.awayScore}
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const top = rank === 1;
  const podium = rank <= 3;
  return (
    <span
      className={`tnum inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
        top
          ? "bg-gold/20 text-gold"
          : podium
            ? "bg-lime/15 text-lime"
            : "bg-panel2 text-mut"
      }`}
    >
      {rank}
    </span>
  );
}
