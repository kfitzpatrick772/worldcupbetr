"use client";

import { useState } from "react";
import { BracketEntry } from "./BracketEntry";
import { saveKnockoutViaToken } from "@/lib/actions";
import type { Picks, R32Teams } from "@/lib/bracket";

type TeamMap = Record<string, { name: string; flag: string }>;
type SlotInfo = { slotLabel: string; homeSource: string | null; awaySource: string | null };

// Soft "is this you?" acknowledgment before revealing the bracket. Not a real
// auth gate — the unguessable link is the capability; this just stops a
// forwarded link being filled out by accident.
export function PicksGate({
  name,
  token,
  locked,
  r32,
  slotInfo,
  teams,
  initial,
}: {
  name: string;
  token: string;
  locked: boolean;
  r32: R32Teams;
  slotInfo: Record<string, SlotInfo>;
  teams: TeamMap;
  initial: Picks;
}) {
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6 text-center sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-mut">
          You&apos;re entering picks as
        </p>
        <p className="my-2 font-display text-4xl text-lime sm:text-5xl">{name}</p>
        <p className="mx-auto mb-6 max-w-sm text-sm text-mut">
          Confirm that&apos;s you, then pick the winner of every match from the Round of 32 to
          the Final. You can come back and change picks any time until the round locks.
        </p>
        <button
          onClick={() => setConfirmed(true)}
          className="rounded-xl bg-lime px-6 py-2.5 font-semibold text-black transition-opacity hover:opacity-90"
        >
          That&apos;s me — start picking
        </button>
        <p className="mt-3 text-xs text-dim">
          Not {name}? Close this tab — you may have been sent the wrong link.
        </p>
      </div>
    );
  }

  return (
    <BracketEntry
      r32={r32}
      slotInfo={slotInfo}
      teams={teams}
      initial={initial}
      locked={locked}
      action={saveKnockoutViaToken}
      hidden={{ token }}
      submitLabel="Submit picks"
    />
  );
}
