// In-process live-score loop. Syncs the score feed every SYNC_INTERVAL_MS
// (default 5 minutes) for the duration of the tournament, starting with one
// sync at server boot. Lives inside the Railway web service, so no external
// scheduler is required — the GitHub Actions "Score sync" workflow stays on
// as an independent watchdog/diagnostic.
//
// Disable with SYNC_INTERVAL_MS=0, or by leaving SCORE_PROVIDER=manual.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 300_000);
  if (!Number.isFinite(intervalMs) || intervalMs < 1_000) {
    console.log("[feed-loop] disabled (SYNC_INTERVAL_MS unset or < 1000)");
    return;
  }

  // Dynamic import keeps Prisma/provider code out of the edge bundle.
  const { getProvider, syncFromProvider } = await import("@/lib/feed");
  const provider = getProvider();
  if (!provider) {
    console.log("[feed-loop] SCORE_PROVIDER=manual — loop not started");
    return;
  }

  // Stop burning API quota once the tournament is over (final: 2026-07-19).
  const WINDOW_START = Date.UTC(2026, 5, 10); // 2026-06-10
  const WINDOW_END = Date.UTC(2026, 6, 21); // 2026-07-21

  let running = false; // skip a tick rather than overlap a slow one
  const tick = async () => {
    const now = Date.now();
    if (now < WINDOW_START || now > WINDOW_END) return;
    if (running) return;
    running = true;
    try {
      const r = await syncFromProvider(provider);
      console.log(
        `[feed-loop] ${provider.name}: matched ${r.matched}/${r.fetched}, updated ${r.updated}` +
          `${r.settled ? ", settled" : ""}` +
          `${r.unmatched.length ? `, UNMATCHED ${r.unmatched.length}` : ""}`,
      );
    } catch (e) {
      console.error("[feed-loop] sync failed:", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };

  setInterval(tick, intervalMs);
  void tick(); // first sync immediately at boot — don't block server readiness
  console.log(`[feed-loop] started — syncing every ${Math.round(intervalMs / 1000)}s`);
}
