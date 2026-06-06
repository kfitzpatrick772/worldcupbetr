import { ApiFootballProvider } from "./apifootball";
import type { ScoreProvider } from "./types";

/** Returns the configured provider, or null for manual-only (admin entry). */
export function getProvider(): ScoreProvider | null {
  const which = (process.env.SCORE_PROVIDER || "manual").toLowerCase();
  switch (which) {
    case "apifootball":
      return new ApiFootballProvider();
    case "manual":
    default:
      return null;
  }
}

export { applyFixtures, syncFromProvider } from "./sync";
export type { SyncResult } from "./sync";
