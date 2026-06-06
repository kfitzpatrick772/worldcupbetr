"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Polls the server for fresh data so the board feels live without websockets.
// Re-pulls the RSC payload (new scores/standings) on an interval and when the
// tab regains focus. Pauses while the tab is hidden to save resources.
export function LiveRefresh({ intervalMs = 25000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      setPulsing(true);
      router.refresh();
      setTimeout(() => setPulsing(false), 800);
    };
    timer = setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, intervalMs]);

  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mut"
      title="Scores refresh automatically"
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${pulsing ? "bg-lime" : "bg-lime/50"}`}
        style={{ boxShadow: pulsing ? "0 0 8px var(--color-lime)" : undefined }}
      />
      Live
    </span>
  );
}
