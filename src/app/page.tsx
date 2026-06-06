// Temporary branded landing — verifies the design system renders.
// Replaced by the live leaderboard / board in Phase 4.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center px-5 py-20">
      <div className="mb-4 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.42em] text-lime">
        <span className="inline-block h-0.5 w-6 bg-lime" />
        FIFA World Cup 2026 · The Pool
      </div>

      <h1 className="font-display text-6xl text-ink sm:text-8xl">
        2026 World Cup
        <br />
        <span className="text-lime">Bracket</span>
      </h1>

      <p className="mt-5 max-w-xl text-mut">
        Live leaderboard and bracket for our pool. Scores update automatically
        after every match — pick a game to see who&apos;s on who, with live
        points and current rank.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Players", v: "—" },
          { k: "Matches", v: "104" },
          { k: "Groups", v: "12" },
          { k: "Status", v: "Setup" },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-4"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-mut">
              {s.k}
            </div>
            <div className="tnum mt-1 text-2xl text-ink">{s.v}</div>
          </div>
        ))}
      </div>

      <p className="mt-10 font-mono text-xs text-dim">
        Build in progress · kickoff June 11, 2026
      </p>
    </main>
  );
}
