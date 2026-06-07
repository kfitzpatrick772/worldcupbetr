import { describe, expect, it } from "vitest";
import {
  deriveKnockoutScoring,
  participantsOf,
  QF_SLOTS,
  R16_SLOTS,
  R32_SLOTS,
  SF_SLOTS,
} from "./bracket";
import type { Picks, R32Teams } from "./bracket";

describe("deriveKnockoutScoring", () => {
  it("derives advance sets + final from per-slot winner picks", () => {
    const picks: Picks = {};
    R32_SLOTS.forEach((s, i) => (picks[s] = `r16_${i}`)); // 16 R16-reachers
    R16_SLOTS.forEach((s, i) => (picks[s] = `qf_${i}`)); // 8
    QF_SLOTS.forEach((s, i) => (picks[s] = `sf_${i}`)); // 4
    picks.M101 = "finA";
    picks.M102 = "finB";
    picks.M104 = "finA"; // champion
    picks.M103 = "third"; // 3rd-place winner

    const { advance, final } = deriveKnockoutScoring(picks);
    expect(advance.filter((a) => a.round === "R16")).toHaveLength(16);
    expect(advance.filter((a) => a.round === "QF")).toHaveLength(8);
    expect(advance.filter((a) => a.round === "SF")).toHaveLength(4);
    expect(advance.filter((a) => a.round === "FINAL").map((a) => a.teamId).sort()).toEqual([
      "finA",
      "finB",
    ]);
    expect(final).toEqual({
      championTeamId: "finA",
      runnerUpTeamId: "finB", // the finalist who isn't champion
      thirdPlaceTeamId: "third",
    });
  });

  it("returns null final until champion + runner-up + third are all set", () => {
    expect(deriveKnockoutScoring({ M104: "x", M101: "x", M102: "y" }).final).toBeNull();
  });
});

describe("participantsOf", () => {
  const r32: R32Teams = {
    M73: { home: "a", away: "b" },
    M75: { home: "c", away: "d" },
  };

  it("R32 slot = its actual teams", () => {
    expect(participantsOf("M73", {}, r32)).toEqual(["a", "b"]);
  });

  it("R16 slot = the user's picked winners of its feeders", () => {
    // M90 = W73 vs W75
    expect(participantsOf("M90", { M73: "a", M75: "c" }, r32)).toEqual(["a", "c"]);
  });

  it("3rd-place slot resolves losers of the semis", () => {
    // M103 = L101 vs L102. Build minimal upstream so M101/M102 participants resolve.
    const picks: Picks = {
      M97: "p", M98: "q", M101: "p", // M101 = p vs q, winner p -> loser q
      M99: "r", M100: "s", M102: "s", // M102 = r vs s, winner s -> loser r
    };
    expect(participantsOf("M103", picks, {})).toEqual(["q", "r"]);
  });
});
