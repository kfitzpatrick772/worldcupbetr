// Pure presentation helpers (no React) shared across the board.

export function stageLabel(stage: string, group: string | null): string {
  switch (stage) {
    case "GROUP":
      return group ? `Group ${group}` : "Group stage";
    case "R32":
      return "Round of 32";
    case "R16":
      return "Round of 16";
    case "QF":
      return "Quarter-final";
    case "SF":
      return "Semi-final";
    case "THIRD":
      return "Third-place";
    case "FINAL":
      return "Final";
    default:
      return stage;
  }
}

export const CATEGORY_LABEL: Record<string, string> = {
  GROUP_MATCH: "Match results",
  GROUP_ADVANCE: "Teams advanced",
  GROUP_WINNER_BONUS: "Group winner bonus",
  GROUP_RUNNERUP_BONUS: "Runner-up bonus",
  BEST_THIRD: "Best thirds",
  ADVANCE_R16: "Reached Round of 16",
  ADVANCE_QF: "Reached Quarter-finals",
  ADVANCE_SF: "Reached Semi-finals",
  ADVANCE_FINAL: "Reached the Final",
  CHAMPION: "Champion",
  RUNNERUP: "Runner-up",
  THIRD_PLACE: "Third place",
};

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const TZ = "America/New_York";

export function formatKickoff(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}

/** Time only, in Eastern, e.g. "3:00 PM ET". */
export function formatTimeET(d: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: TZ,
    }).format(d) + " ET"
  );
}

export function formatDay(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  }).format(d);
}

export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  }).format(d);
}
