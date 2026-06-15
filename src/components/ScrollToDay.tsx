"use client";

import { useEffect } from "react";

/** On first load of the Matches page, jump to the current (or next upcoming)
 *  matchday instead of the tournament opener. No-op if the user arrived via an
 *  explicit hash anchor. */
export function ScrollToDay({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (window.location.hash) return;
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ block: "start" });
  }, [targetId]);
  return null;
}
