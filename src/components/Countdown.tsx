"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Live countdown to a target time. When it reaches zero it refreshes the page
// so the board flips from the countdown to the live leaderboard.
export function Countdown({ targetMs }: { targetMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= targetMs) router.refresh();
    }, 1000);
    return () => clearInterval(t);
  }, [targetMs, router]);

  const diff = Math.max(0, targetMs - (now ?? targetMs));
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  const units = [
    { v: d, l: "Days" },
    { v: h, l: "Hrs" },
    { v: m, l: "Min" },
    { v: s, l: "Sec" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3" suppressHydrationWarning>
      {units.map((u) => (
        <div
          key={u.l}
          className="rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel py-4 text-center"
        >
          <div className="tnum font-display text-4xl text-lime sm:text-6xl">{pad(u.v)}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-mut">
            {u.l}
          </div>
        </div>
      ))}
    </div>
  );
}
