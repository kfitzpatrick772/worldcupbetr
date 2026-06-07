import { requireAdmin } from "@/lib/auth";
import { runSelfCheck } from "@/lib/scoring/selfcheck";
import { verifyScoring } from "@/lib/scoring/verify";
import { POINTS } from "@/lib/scoring/engine";
import { formatKickoff } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ScoringPage() {
  await requireAdmin();
  const evals = runSelfCheck();
  const v = await verifyScoring();

  const evalsPass = evals.passed === evals.total;
  const allGood = evalsPass && v.allGood;

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink">Scoring</h1>
      <p className="mb-5 text-sm text-mut">
        Independent verification that the engine matches the league rules and that every
        stored point is correct. Re-runs on every visit.
      </p>

      {/* Headline status */}
      <div
        className={`mb-7 rounded-2xl border p-5 ${
          allGood ? "border-lime/40 bg-lime/10" : "border-red/50 bg-red/10"
        }`}
      >
        <div className={`font-display text-2xl ${allGood ? "text-lime" : "text-red"}`}>
          {allGood ? "✓ Scoring verified — 100% accurate" : "✗ Scoring needs attention"}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Rule evals" value={`${evals.passed}/${evals.total}`} ok={evalsPass} />
          <Tile label="Matches checked" value={v.matchesChecked} ok />
          <Tile label="Match errors" value={v.matchDiscrepancies} ok={v.matchDiscrepancies === 0} />
          <Tile label="Standing errors" value={v.standingDiscrepancies.length} ok={v.standingDiscrepancies.length === 0} />
        </div>
        {v.lastSettledAt && (
          <div className="mt-3 font-mono text-xs text-dim">last settled {formatKickoff(v.lastSettledAt)}</div>
        )}
      </div>

      {/* 1. Engine evals (rulebook worked examples) */}
      <h2 className="mb-2 font-display text-xl text-ink">Rule evals (engine vs rulebook)</h2>
      <p className="mb-3 text-sm text-mut">
        Every rule below is run live through the scoring engine and checked against the
        expected points. This works even before the tournament starts.
      </p>
      <div className="mb-8 overflow-hidden rounded-2xl border border-line">
        {evals.checks.map((c) => (
          <div key={c.name} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
            <span className={`shrink-0 text-lg ${c.pass ? "text-lime" : "text-red"}`}>{c.pass ? "✓" : "✗"}</span>
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium text-ink">{c.name}</span>
              <span className="block font-mono text-xs text-dim">{c.rule}</span>
            </span>
            <span className={`tnum shrink-0 text-sm ${c.pass ? "text-mut" : "text-red"}`}>
              {c.pass ? `${c.got} pts` : `got ${c.got}, expected ${c.expected}`}
            </span>
          </div>
        ))}
      </div>

      {/* 2. Per-match checkpoints */}
      <h2 className="mb-2 font-display text-xl text-ink">Per-match checkpoints</h2>
      <p className="mb-3 text-sm text-mut">
        After each match finishes, every player&apos;s points for it are re-derived by a
        separate calculation and compared to what&apos;s stored.
      </p>
      {v.matchChecks.length === 0 ? (
        <div className="mb-8 rounded-xl border border-line bg-panel p-4 text-sm text-mut">
          No finished matches yet — checkpoints appear here as games complete. (The rule
          evals above already confirm the engine is correct.)
        </div>
      ) : (
        <div className="mb-8 space-y-2">
          {v.matchChecks.map((m) => {
            const ok = m.discrepancies.length === 0;
            return (
              <div key={m.matchId} className="rounded-xl border border-line bg-panel px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${ok ? "text-lime" : "text-red"}`}>{ok ? "✓" : "✗"}</span>
                  <span className="flex-1 text-sm text-ink">
                    {m.group ? `Group ${m.group} · ` : ""}{m.label}
                  </span>
                  <span className="font-mono text-xs text-mut">{m.players} players</span>
                </div>
                {!ok && (
                  <ul className="mt-2 space-y-1 border-t border-line/60 pt-2 text-xs text-red">
                    {m.discrepancies.map((d, i) => (
                      <li key={i}>
                        {d.name}: stored {d.stored}, should be {d.expected}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {v.standingDiscrepancies.length > 0 && (
        <div className="mb-8 rounded-xl border border-red/50 bg-red/10 p-4 text-sm text-red">
          <b>Standing totals out of sync</b> (run Settle on the Dashboard):
          <ul className="mt-1">
            {v.standingDiscrepancies.map((d, i) => (
              <li key={i}>{d.name}: stored {d.stored}, fresh recompute {d.fresh}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Scoring rules (league owner) + engine values */}
      <h2 className="mb-2 font-display text-xl text-ink">Scoring rules</h2>
      <p className="mb-3 text-sm text-mut">
        As provided by the league owner — and the exact values the engine awards.
      </p>
      <div className="overflow-hidden rounded-2xl border border-line">
        {RULES(POINTS).map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-line/60 px-4 py-2.5 last:border-0">
            <span className="text-sm text-ink">{r.label}</span>
            <span className="tnum text-sm font-bold text-lime">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-dim">
        Note: the 2026 format has 72 group matches (the rules doc said 48, which was the
        old 32-team format). All 72 are scored.
      </p>
    </div>
  );
}

function Tile({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-bg/40 p-3">
      <div className="font-mono text-[11px] uppercase tracking-wider text-mut">{label}</div>
      <div className={`tnum mt-0.5 text-xl font-bold ${ok ? "text-ink" : "text-red"}`}>{value}</div>
    </div>
  );
}

function RULES(P: typeof POINTS) {
  return [
    { label: "Group match — correct winner/draw", value: `${P.groupResult}` },
    { label: "Group match — exact scoreline (bonus)", value: `+${P.groupExactBonus}` },
    { label: "Team advances (top 2 of group)", value: `${P.advance}` },
    { label: "Correct group winner (bonus)", value: `+${P.groupWinnerBonus}` },
    { label: "Correct runner-up (bonus)", value: `+${P.groupRunnerUpBonus}` },
    { label: "Best third-place qualifier (each)", value: `${P.bestThird}` },
    { label: "Round of 32 — correct advancing team", value: `${P.reach.R16}` },
    { label: "Round of 16 — correct advancing team", value: `${P.reach.QF}` },
    { label: "Quarter-final — correct advancing team", value: `${P.reach.SF}` },
    { label: "Semi-final — correct advancing team", value: `${P.reach.FINAL}` },
    { label: "Third-place match winner", value: `${P.thirdPlace}` },
    { label: "Champion", value: `${P.champion}` },
    { label: "Runner-up (bonus)", value: `+${P.runnerUp}` },
  ];
}
