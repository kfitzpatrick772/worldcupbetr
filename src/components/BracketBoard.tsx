"use client";

import { useState } from "react";
import type { BracketData, BracketMatch, SlotTeam } from "@/lib/queries";
import { formatDay, formatTimeET } from "@/lib/format";
import { LiveBadge } from "@/components/ui";

const ROUND_ORDER = ["R32", "R16", "QF", "SF", "FINAL", "THIRD"] as const;
const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  FINAL: "Final",
  THIRD: "Third place",
};

function winnerId(m: BracketMatch): string | null {
  if (m.status !== "FINISHED") return null;
  if (m.winnerTeamId) return m.winnerTeamId;
  if (m.home.kind === "team" && m.away.kind === "team" && m.homeScore != null && m.awayScore != null) {
    if (m.homeScore > m.awayScore) return m.home.teamId;
    if (m.awayScore > m.homeScore) return m.away.teamId;
  }
  return null;
}

export function BracketBoard({ data }: { data: BracketData }) {
  const [view, setView] = useState<"tree" | "list">("tree");

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Bracket</h1>
        <div className="inline-flex shrink-0 rounded-full border border-line bg-panel p-0.5 font-mono text-xs">
          {(["tree", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1.5 font-semibold uppercase tracking-wide transition-colors ${
                view === v ? "bg-lime text-black" : "text-mut hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "list" ? <ListView data={data} /> : <TreeView data={data} />}
    </div>
  );
}

/* ---------------- List view (default, mobile-first) ---------------- */

function ListView({ data }: { data: BracketData }) {
  return (
    <div className="space-y-8">
      {ROUND_ORDER.map((stage) => {
        const ms = data.matches.filter((m) => m.stage === stage);
        if (ms.length === 0) return null;
        return (
          <section key={stage}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-display text-xl text-ink">{ROUND_LABEL[stage]}</h2>
              {stage === "R32" && (
                <>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-lime2 to-lime"
                      style={{ width: `${Math.round((data.r32Locked / 32) * 100)}%` }}
                    />
                  </span>
                  <span className="shrink-0 font-mono text-xs text-mut">
                    <b className="text-ink">{data.r32Locked}</b> / 32 locked
                  </span>
                </>
              )}
            </div>
            <div className="space-y-2.5">
              {ms.map((m) => (
                <MatchCard key={m.slotLabel} m={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MatchCard({ m }: { m: BracketMatch }) {
  const win = winnerId(m);
  const live = m.status === "LIVE";
  const finished = m.status === "FINISHED";
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-dim">
        <span>{m.slotLabel} · {formatDay(m.kickoff)}</span>
        {live ? (
          <LiveBadge />
        ) : finished ? (
          <span className="text-mut">Full-time</span>
        ) : (
          <span>{formatTimeET(m.kickoff)}</span>
        )}
      </div>
      <SlotRow team={m.home} source={m.homeSource} score={m.homeScore} show={live || finished} winner={win === teamIdOf(m.home)} loser={!!win && win !== teamIdOf(m.home)} />
      <div className="border-t border-line/50" />
      <SlotRow team={m.away} source={m.awaySource} score={m.awayScore} show={live || finished} winner={win === teamIdOf(m.away)} loser={!!win && win !== teamIdOf(m.away)} />
    </div>
  );
}

function teamIdOf(t: SlotTeam): string | null {
  return t.kind === "team" ? t.teamId : null;
}

function SlotRow({
  team, source, score, show, winner, loser,
}: {
  team: SlotTeam;
  source: string | null;
  score: number | null;
  show: boolean;
  winner: boolean;
  loser: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 ${loser ? "opacity-60" : ""}`}>
      <SlotFlag team={team} />
      <span className={`min-w-0 flex-1 truncate text-[0.95rem] ${
        team.kind === "team" ? (winner ? "font-bold text-lime" : "font-semibold text-ink") : "font-medium text-dim"
      }`}>
        {team.kind === "team" ? team.name : team.label}
      </span>
      {source && team.kind === "team" && <SourceTag source={source} />}
      {show && score != null && (
        <span className={`tnum w-5 text-right text-base ${winner ? "font-bold text-lime" : "font-semibold text-ink"}`}>{score}</span>
      )}
    </div>
  );
}

function SlotFlag({ team }: { team: SlotTeam }) {
  if (team.kind === "team") return <span className="w-6 shrink-0 text-center text-xl leading-none">{team.flag}</span>;
  const color = team.variant === "third" ? "border-blue/60" : "border-line2";
  return <span className={`grid h-5 w-6 shrink-0 place-items-center`}><span className={`h-2.5 w-2.5 rounded-full border ${color}`} /></span>;
}

function SourceTag({ source }: { source: string }) {
  return (
    <span className="shrink-0 rounded border border-lime/25 bg-lime/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-lime">
      {source}
    </span>
  );
}

/* ---------------- Tree view (toggle) ---------------- */

function TreeView({ data }: { data: BracketData }) {
  const cols: { stage: string; label: string }[] = [
    { stage: "R32", label: "Round of 32" },
    { stage: "R16", label: "Round of 16" },
    { stage: "QF", label: "Quarter-finals" },
    { stage: "SF", label: "Semi-finals" },
    { stage: "FINAL", label: "Final" },
  ];
  const third = data.matches.find((m) => m.stage === "THIRD");
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line2 bg-gradient-to-b from-bg2 to-panel p-3 shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:p-5">
        <div className="mx-auto w-max">
          {/* round headers, kept out of the centering flow so the columns align */}
          <div className="mb-3 flex gap-4 sm:gap-6">
            {cols.map((c) => (
              <div
                key={c.stage}
                className="w-[8.5rem] text-center font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-lime sm:w-40"
              >
                {c.label}
              </div>
            ))}
          </div>
          {/* equal-height columns; justify-around centers each tile between its pair */}
          <div className="flex gap-4 sm:gap-6">
            {cols.map((c) => {
              const ms = data.matches.filter((m) => m.stage === c.stage);
              return (
                <div key={c.stage} className="flex w-[8.5rem] flex-col justify-around sm:w-40">
                  {ms.map((m) => (
                    <TreeSlot key={m.slotLabel} m={m} stage={c.stage} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {third && (
        <div className="mt-4">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-dim">
            Third place
          </div>
          <div className="max-w-[18rem]">
            <TreeSlot m={third} stage="THIRD" />
          </div>
        </div>
      )}
      <p className="mt-3 text-center font-mono text-[11px] text-dim">Scroll sideways for all rounds</p>
    </div>
  );
}

function TreeSlot({ m, stage }: { m: BracketMatch; stage: string }) {
  const win = winnerId(m);
  const isFinal = stage === "FINAL";
  const live = m.status === "LIVE";
  const accent = isFinal
    ? "border-gold/60 shadow-[0_0_16px_rgba(247,201,72,0.18)]"
    : live
      ? "border-red/55 shadow-[0_0_14px_rgba(255,107,107,0.16)]"
      : "border-line2 hover:border-lime/40";
  return (
    <div
      className={`my-1.5 rounded-xl border bg-gradient-to-b from-raised to-panel px-2.5 py-2 shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-colors ${accent}`}
    >
      <TreeSide team={m.home} score={m.homeScore} winner={win === teamIdOf(m.home)} dim={!!win && win !== teamIdOf(m.home)} />
      <div className="my-1.5 h-px bg-line2/80" />
      <TreeSide team={m.away} score={m.awayScore} winner={win === teamIdOf(m.away)} dim={!!win && win !== teamIdOf(m.away)} />
    </div>
  );
}

function shortLabel(team: Extract<SlotTeam, { kind: "placeholder" }>): string {
  if (team.variant === "third") return "3rd place";
  return team.label;
}

function TreeSide({ team, score, winner, dim }: { team: SlotTeam; score: number | null; winner: boolean; dim: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${dim ? "opacity-50" : ""}`}>
      {team.kind === "team" ? (
        <span className="text-base leading-none">{team.flag}</span>
      ) : (
        <span className={`h-2 w-2 shrink-0 rounded-full border ${team.variant === "third" ? "border-blue/60" : "border-line2"}`} />
      )}
      <span className={`min-w-0 flex-1 truncate text-[0.8rem] ${
        team.kind === "team" ? (winner ? "font-bold text-lime" : "font-semibold text-ink") : "italic text-dim"
      }`}>
        {team.kind === "team" ? team.name : shortLabel(team)}
      </span>
      {score != null && <span className={`tnum text-xs font-semibold ${winner ? "text-lime" : "text-mut"}`}>{score}</span>}
    </div>
  );
}
