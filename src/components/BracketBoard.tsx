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
  const [view, setView] = useState<"list" | "tree">("list");

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Bracket</h1>
        <div className="inline-flex shrink-0 rounded-full border border-line bg-panel p-0.5 font-mono text-xs">
          {(["list", "tree"] as const).map((v) => (
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
    { stage: "R32", label: "R32" },
    { stage: "R16", label: "R16" },
    { stage: "QF", label: "QF" },
    { stage: "SF", label: "SF" },
    { stage: "FINAL", label: "Final" },
  ];
  const third = data.matches.find((m) => m.stage === "THIRD");
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel p-3">
        <div className="flex min-w-[680px] gap-2">
          {cols.map((c) => {
            const ms = data.matches.filter((m) => m.stage === c.stage);
            return (
              <div key={c.stage} className="flex flex-1 flex-col justify-around gap-2">
                <div className="mb-1 text-center font-mono text-[10px] uppercase tracking-widest text-dim">{c.label}</div>
                {ms.map((m) => (
                  <TreeSlot key={m.slotLabel} m={m} highlight={c.stage === "FINAL"} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {third && (
        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-dim">Third place</div>
          <div className="max-w-xs"><TreeSlot m={third} /></div>
        </div>
      )}
      <p className="mt-3 text-center font-mono text-[11px] text-dim">Scroll sideways for later rounds</p>
    </div>
  );
}

function TreeSlot({ m, highlight }: { m: BracketMatch; highlight?: boolean }) {
  const win = winnerId(m);
  return (
    <div className={`rounded-lg border bg-bg2 px-2 py-1.5 ${highlight ? "border-gold/50" : "border-line"}`}>
      <TreeSide team={m.home} score={m.homeScore} winner={win === teamIdOf(m.home)} dim={!!win && win !== teamIdOf(m.home)} />
      <div className="my-1 border-t border-line/50" />
      <TreeSide team={m.away} score={m.awayScore} winner={win === teamIdOf(m.away)} dim={!!win && win !== teamIdOf(m.away)} />
    </div>
  );
}

function TreeSide({ team, score, winner, dim }: { team: SlotTeam; score: number | null; winner: boolean; dim: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${dim ? "opacity-55" : ""}`}>
      {team.kind === "team" ? (
        <span className="text-sm leading-none">{team.flag}</span>
      ) : (
        <span className={`h-2 w-2 rounded-full border ${team.variant === "third" ? "border-blue/60" : "border-line2"}`} />
      )}
      <span className={`min-w-0 flex-1 truncate text-xs ${
        team.kind === "team" ? (winner ? "font-bold text-lime" : "text-ink") : "italic text-dim"
      }`}>
        {team.kind === "team" ? team.name : team.label}
      </span>
      {score != null && <span className={`tnum text-xs ${winner ? "text-lime" : "text-mut"}`}>{score}</span>}
    </div>
  );
}
