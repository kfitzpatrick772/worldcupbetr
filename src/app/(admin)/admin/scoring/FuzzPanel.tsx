"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/format";
import {
  runFuzz,
  runFuzzCase,
  runSanityCheck,
  type FuzzFailure,
  type FuzzReport,
  type SanityReport,
} from "@/lib/scoring/fuzz";

// The clickable randomized test: generate full synthetic scenarios (12 players
// with random picks across every category + random results), grade each with both
// the real engine and an independent oracle, and report any disagreement. Runs
// entirely in YOUR browser (no server / DB / network), which is why it's instant.

const BATCH = 2000; // scenarios per click / per loop tick

const CAT_ORDER = [
  "GROUP_MATCH", "GROUP_ADVANCE", "GROUP_WINNER_BONUS", "GROUP_RUNNERUP_BONUS",
  "BEST_THIRD", "ADVANCE_R16", "ADVANCE_QF", "ADVANCE_SF", "ADVANCE_FINAL",
  "CHAMPION", "RUNNERUP", "THIRD_PLACE",
] as const;

function label(cat: string) {
  return CATEGORY_LABEL[cat] ?? cat;
}

export function FuzzPanel() {
  const [total, setTotal] = useState(0);
  const [failedTotal, setFailedTotal] = useState(0);
  const [report, setReport] = useState<FuzzReport | null>(null);
  const [running, setRunning] = useState(false);
  const [looping, setLooping] = useState(false);
  const [seedInput, setSeedInput] = useState("");
  const [repro, setRepro] = useState<{ seed: number; fails: FuzzFailure[] } | null>(null);
  const [perf, setPerf] = useState<{ ms: number; rate: number } | null>(null);
  const [sanity, setSanity] = useState<SanityReport | null>(null);
  const baseRef = useRef(1);
  const loopRef = useRef(false);

  const runOnce = useCallback((): FuzzReport => {
    const base = baseRef.current;
    baseRef.current = (base + BATCH) >>> 0;
    const t0 = performance.now();
    const r = runFuzz(BATCH, base);
    const ms = performance.now() - t0;
    setPerf({ ms, rate: Math.round((r.iterations / ms) * 1000) });
    setReport(r);
    setTotal((t) => t + r.iterations);
    if (!r.ok) setFailedTotal((f) => f + r.failed);
    return r;
  }, []);

  const runBatch = useCallback(() => {
    setRunning(true);
    // yield (via a macrotask, which fires even in a backgrounded tab — unlike
    // requestAnimationFrame) so the button can paint "Running…" before the
    // synchronous fuzzing blocks the thread.
    setTimeout(() => {
      runOnce();
      setRunning(false);
    }, 0);
  }, [runOnce]);

  // Continuous mode: while `looping`, keep running fresh batches (each with new
  // seeds, yielding between ticks so the UI stays responsive). Stops on toggle-off
  // or the first failure, so a discrepancy is never scrolled past.
  useEffect(() => {
    if (!looping) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || !loopRef.current) return;
      const r = runOnce();
      if (!r.ok) {
        loopRef.current = false;
        setLooping(false);
        setRunning(false);
        return;
      }
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
    return () => {
      cancelled = true;
    };
  }, [looping, runOnce]);

  const startLoop = useCallback(() => {
    loopRef.current = true;
    setLooping(true);
    setRunning(true);
  }, []);

  const stopLoop = useCallback(() => {
    loopRef.current = false;
    setLooping(false);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    stopLoop();
    setTotal(0);
    setFailedTotal(0);
    setReport(null);
    setRepro(null);
    setPerf(null);
    setSanity(null);
    baseRef.current = 1;
  }, [stopLoop]);

  const reproduce = useCallback(() => {
    const seed = Number(seedInput.trim());
    if (!Number.isFinite(seed)) return;
    setRepro({ seed, fails: runFuzzCase(seed) });
  }, [seedInput]);

  const sanityCheck = useCallback(() => {
    setSanity(runSanityCheck());
  }, []);

  const ok = !report || report.ok;
  const allGreen = ok && failedTotal === 0;

  return (
    <div className="mb-8 rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Randomized eval loop</h2>
          <p className="mt-1 max-w-xl text-sm text-mut">
            Each scenario invents 12 players with random picks across <em>every</em> category
            and a random set of results, then grades everyone two ways — the real engine and a
            separate, independently-written rulebook calculator. If they ever disagree, the
            exact case is shown below so the engine can be fixed. It runs entirely in your
            browser (no AI, no server) — that&apos;s why thousands of cases finish in
            milliseconds. &ldquo;Pass&rdquo; means the two agreed exactly.
          </p>
        </div>
        <div
          className={`tnum shrink-0 rounded-xl border px-4 py-2 text-center ${
            allGreen ? "border-lime/40 bg-lime/10" : "border-red/50 bg-red/10"
          }`}
        >
          <div className={`text-2xl font-bold ${allGreen ? "text-lime" : "text-red"}`}>
            {failedTotal === 0 ? "✓" : failedTotal}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-mut">
            {failedTotal === 0 ? "all passing" : "failures"}
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={runBatch}
          disabled={running}
          className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running && !looping ? "Running…" : `Run ${BATCH.toLocaleString()} tests`}
        </button>
        {!looping ? (
          <button
            onClick={startLoop}
            disabled={running}
            className="rounded-full border border-lime/50 px-4 py-1.5 text-sm font-semibold text-lime transition-colors hover:bg-lime/10 disabled:opacity-50"
          >
            ▶ Run continuously
          </button>
        ) : (
          <button
            onClick={stopLoop}
            className="rounded-full border border-red/50 px-4 py-1.5 text-sm font-semibold text-red transition-colors hover:bg-red/10"
          >
            ■ Stop
          </button>
        )}
        <button
          onClick={reset}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-mut transition-colors hover:bg-panel2 hover:text-ink"
        >
          Reset
        </button>
        <span className="tnum ml-auto font-mono text-xs text-dim">
          {total.toLocaleString()} scenarios run{looping ? " · running…" : ""}
        </span>
      </div>

      {/* timing — makes the speed transparent (it's your CPU doing the work) */}
      {perf && (
        <div className="mt-2 font-mono text-[11px] text-dim">
          last batch: {BATCH.toLocaleString()} scenarios ({(BATCH * 12).toLocaleString()} player
          gradings) in {perf.ms.toFixed(0)} ms ·{" "}
          <span className="text-mut">{perf.rate.toLocaleString()} scenarios/sec on this device</span>
        </div>
      )}

      {/* result */}
      {report && (
        <div className="mt-4">
          {report.ok ? (
            <div className="rounded-xl border border-lime/30 bg-lime/5 p-4">
              <div className="text-sm font-semibold text-lime">
                ✓ Engine matched the independent oracle on all {report.iterations.toLocaleString()} scenarios
                this batch.
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {CAT_ORDER.map((c) => (
                  <div key={c} className="flex items-center gap-1.5 font-mono text-[11px] text-mut">
                    <span className="text-lime">✓</span> {label(c)}
                  </div>
                ))}
              </div>
              <p className="mt-3 font-mono text-[11px] text-dim">
                Every category above was exercised with correct, wrong, and edge-case (duplicate /
                missing / live-vs-finished) picks, and the live total, locked total, and
                max-possible ceiling all reconciled.
              </p>
            </div>
          ) : (
            <Failure report={report} />
          )}
        </div>
      )}

      {/* self-test: prove the checker isn't rigged to always say "pass" */}
      <div className="mt-5 border-t border-line/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-mut">
              Prove it can catch a bug
            </div>
            <p className="mt-1 max-w-xl text-xs text-dim">
              Plants a deliberate 1-point error in every grading and checks the detector flags it.
              If &ldquo;pass&rdquo; were free, this would catch nothing.
            </p>
          </div>
          <button
            onClick={sanityCheck}
            className="rounded-full border border-line px-4 py-1.5 text-sm text-ink transition-colors hover:bg-panel2"
          >
            Run self-test
          </button>
        </div>
        {sanity && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              sanity.ok ? "border-lime/30 bg-lime/5 text-lime" : "border-red/50 bg-red/10 text-red"
            }`}
          >
            {sanity.ok ? "✓ " : "✗ "}
            Planted a +1 error in all{" "}
            <span className="tnum font-bold">{sanity.planted.toLocaleString()}</span> gradings
            ({sanity.scenarios} scenarios) → detector flagged{" "}
            <span className="tnum font-bold">{sanity.caught.toLocaleString()}</span>
            {sanity.ok
              ? " (100%). The check is real."
              : " — detector missed some; investigate."}
            {sanity.sample && (
              <span className="block font-mono text-[11px] text-mut">
                e.g. seed {sanity.sample.seed}, player {sanity.sample.player}: correct{" "}
                {sanity.sample.clean} → tampered {sanity.sample.tampered} (flagged)
              </span>
            )}
          </div>
        )}
      </div>

      {/* reproduce a specific seed (the correct-and-improve loop) */}
      <div className="mt-5 border-t border-line/60 pt-4">
        <div className="font-mono text-[11px] uppercase tracking-wider text-mut">
          Reproduce a failing seed
        </div>
        <p className="mt-1 text-xs text-dim">
          Paste a seed from a failure to replay that exact scenario after changing the engine —
          this is the fix-and-verify loop.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            inputMode="numeric"
            placeholder="seed e.g. 123456"
            className="tnum w-40 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-lime"
          />
          <button
            onClick={reproduce}
            className="rounded-full border border-line px-4 py-1.5 text-sm text-ink transition-colors hover:bg-panel2"
          >
            Reproduce seed
          </button>
        </div>
        {repro && (
          <div className="mt-3">
            {repro.fails.length === 0 ? (
              <div className="rounded-lg border border-lime/30 bg-lime/5 px-3 py-2 text-sm text-lime">
                ✓ Seed {repro.seed} passes — engine and oracle agree on all 12 players.
              </div>
            ) : (
              <FailureDetail fail={repro.fails[0]} extra={repro.fails.length - 1} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Failure({ report }: { report: FuzzReport }) {
  return (
    <div className="rounded-xl border border-red/50 bg-red/10 p-4">
      <div className="text-sm font-semibold text-red">
        ✗ {report.failed.toLocaleString()} of {report.iterations.toLocaleString()} scenarios disagreed.
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-red/90">
        {Object.entries(report.byCategory).map(([c, n]) => (
          <span key={c}>
            {label(c)}: {n}
          </span>
        ))}
      </div>
      {report.firstFailure && <FailureDetail fail={report.firstFailure} />}
      {report.failingSeeds.length > 0 && (
        <p className="mt-3 font-mono text-[11px] text-red/90">
          Add to <code className="text-ink">REGRESSION_SEEDS</code> in{" "}
          <code className="text-ink">fuzz.ts</code> after fixing:{" "}
          <span className="text-ink">[{report.failingSeeds.join(", ")}]</span>
        </p>
      )}
    </div>
  );
}

function FailureDetail({ fail, extra = 0 }: { fail: FuzzFailure; extra?: number }) {
  return (
    <div className="mt-3 rounded-lg border border-red/40 bg-bg/50 p-3">
      <div className="text-sm text-ink">
        <span className="font-semibold text-red">{label(String(fail.category))}</span> ({fail.field}):
        engine gave <span className="tnum font-bold text-red">{fail.got}</span>, rulebook expects{" "}
        <span className="tnum font-bold text-lime">{fail.expected}</span>
        {extra > 0 && <span className="text-mut"> · +{extra} more discrepancy(ies)</span>}
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-mut">
        {fail.repro}
      </pre>
    </div>
  );
}
