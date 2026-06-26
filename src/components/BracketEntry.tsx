"use client";
import { useMemo, useState } from "react";
import {
  FINAL_SLOT,
  participantsOf,
  QF_SLOTS,
  R16_SLOTS,
  R32_SLOTS,
  SF_SLOTS,
  THIRD_SLOT,
  type Picks,
  type R32Teams,
} from "@/lib/bracket";

type TeamMap = Record<string, { name: string; flag: string }>;
type SlotInfo = {
  slotLabel: string;
  homeSource: string | null;
  awaySource: string | null;
};

const ALL = [...R32_SLOTS, ...R16_SLOTS, ...QF_SLOTS, ...SF_SLOTS, THIRD_SLOT, FINAL_SLOT];

export function BracketEntry({
  r32,
  slotInfo,
  teams,
  initial,
  locked,
  action,
  hidden,
  submitLabel = "Save bracket",
}: {
  r32: R32Teams;
  slotInfo: Record<string, SlotInfo>;
  teams: TeamMap;
  initial: Picks;
  locked: boolean;
  // The server action the form posts to (admin save or token-based submit).
  action: (formData: FormData) => void | Promise<void>;
  // Hidden form fields identifying who this is (admin: participantId+slug;
  // contestant: token). Never the source of truth for identity on the token
  // path — the action re-resolves the participant from the token.
  hidden: Record<string, string>;
  submitLabel?: string;
}) {
  const [picks, setPicks] = useState<Picks>(initial);

  // Clearing an upstream winner invalidates downstream picks — prune until stable.
  function pick(slot: string, teamId: string) {
    if (locked) return;
    setPicks((prev) => {
      const next: Picks = { ...prev, [slot]: prev[slot] === teamId ? undefined : teamId };
      let changed = true;
      while (changed) {
        changed = false;
        for (const s of ALL) {
          if (next[s]) {
            const [a, b] = participantsOf(s, next, r32);
            if (next[s] !== a && next[s] !== b) {
              next[s] = undefined;
              changed = true;
            }
          }
        }
      }
      return next;
    });
  }

  const made = useMemo(() => ALL.filter((s) => picks[s]).length, [picks]);

  const label = (id: string | null) =>
    id && teams[id] ? `${teams[id].flag} ${teams[id].name}` : null;

  function Card({ slot }: { slot: string }) {
    const [a, b] = participantsOf(slot, picks, r32);
    const info = slotInfo[slot];
    const champion = slot === FINAL_SLOT;
    return (
      <div className="rounded-xl border border-line bg-panel p-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-dim">
          <span>{slot}</span>
          {champion && <span className="text-gold">Champion</span>}
        </div>
        {[a, b].map((id, i) => {
          const src = i === 0 ? info?.homeSource : info?.awaySource;
          const txt = label(id);
          const selected = id && picks[slot] === id;
          return (
            <button
              key={i}
              type="button"
              disabled={!id || locked}
              onClick={() => id && pick(slot, id)}
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm last:mb-0 transition-colors ${
                selected
                  ? champion
                    ? "bg-gold/20 text-gold ring-1 ring-gold/50"
                    : "bg-lime/20 text-lime ring-1 ring-lime/50"
                  : id
                    ? "bg-bg text-ink hover:bg-panel2"
                    : "cursor-not-allowed bg-bg/40 text-dim"
              }`}
            >
              <span className="truncate">{txt ?? <span className="text-dim">{src ?? "—"}</span>}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const Round = ({ title, slots, cols }: { title: string; slots: string[]; cols: string }) => (
    <section>
      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-lime">{title}</h3>
      <div className={`grid gap-2 ${cols}`}>
        {slots.map((s) => (
          <Card key={s} slot={s} />
        ))}
      </div>
    </section>
  );

  return (
    <form action={action} className="space-y-6 pb-24">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {ALL.filter((s) => picks[s]).map((s) => (
        <input key={s} type="hidden" name={`k_${s}`} value={picks[s]} />
      ))}

      <Round title="Round of 32 — pick winners (10 pts each)" slots={R32_SLOTS} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <Round title="Round of 16 (20 pts)" slots={R16_SLOTS} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <Round title="Quarter-finals (40 pts)" slots={QF_SLOTS} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <Round title="Semi-finals (80 pts)" slots={SF_SLOTS} cols="sm:grid-cols-2" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Round title="Final — champion (160) + runner-up (40)" slots={[FINAL_SLOT]} cols="" />
        <Round title="Third-place winner (40)" slots={[THIRD_SLOT]} cols="" />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="tnum font-mono text-[11px] text-dim">{made}/32 picked</span>
          <button
            disabled={locked}
            className="rounded-xl bg-lime px-6 py-2.5 font-semibold text-black hover:opacity-90 disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
