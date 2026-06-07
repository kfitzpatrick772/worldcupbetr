"use client";
import { useEffect, useState } from "react";

// A ticking match clock for LIVE games, estimated from the scheduled kickoff
// (≈ first half 0–45', a ~15-min half-time, second half to 90'+). It's an
// estimate; when the API feed is connected it supplies the official minute.
export function LiveMinute({ kickoffMs }: { kickoffMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0); // deferred so it's not a sync effect setState
    const iv = setInterval(update, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);
  if (now == null) return null; // don't render time on the server (hydration-safe)

  const mins = Math.floor((now - kickoffMs) / 60000);
  let label: string;
  if (mins < 0) label = "0'";
  else if (mins <= 45) label = `${mins}'`;
  else if (mins <= 60) label = "HT";
  else if (mins <= 105) label = `${mins - 15}'`;
  else label = "90'+";

  return (
    <span className="tnum" suppressHydrationWarning>
      {label}
    </span>
  );
}
