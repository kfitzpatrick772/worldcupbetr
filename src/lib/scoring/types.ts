// Pure scoring types — intentionally decoupled from Prisma so the engine is a
// plain function of (locked picks, stored actuals) and is trivially testable.

export type Stage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";
export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";
export type Outcome = "HOME" | "AWAY" | "DRAW";
export type AdvanceRound = "R16" | "QF" | "SF" | "FINAL";

export type ScoreCategory =
  | "GROUP_MATCH"
  | "GROUP_ADVANCE"
  | "GROUP_WINNER_BONUS"
  | "GROUP_RUNNERUP_BONUS"
  | "BEST_THIRD"
  | "ADVANCE_R16"
  | "ADVANCE_QF"
  | "ADVANCE_SF"
  | "ADVANCE_FINAL"
  | "CHAMPION"
  | "RUNNERUP"
  | "THIRD_PLACE";

export interface MatchResult {
  id: string;
  stage: Stage;
  group: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
}

export interface ParticipantPicks {
  participantId: string;
  groupMatch: { matchId: string; predHome: number; predAway: number }[];
  groupStanding: { group: string; position: number; teamId: string }[];
  bestThird: string[]; // teamIds (up to 8)
  advance: { round: AdvanceRound; teamId: string }[];
  final: {
    championTeamId: string;
    runnerUpTeamId: string;
    thirdPlaceTeamId: string;
  } | null;
}

export interface Actuals {
  // Per group: actual finishing positions (1..4). Presence of pos 1 & 2 marks
  // the group's standings as decided.
  groupStandings: { group: string; position: number; teamId: string }[];
  groupsFinalized: string[]; // groups whose standings are official
  bestThirds: string[]; // the 8 qualifying third-place teams
  bestThirdsFinalized: boolean;
  // Teams that actually reached each knockout round (won the prior round).
  advance: { round: AdvanceRound; teamId: string }[];
  advanceFinalized: AdvanceRound[]; // rounds whose advancer set is complete
  final: {
    championTeamId: string | null;
    runnerUpTeamId: string | null;
    thirdPlaceTeamId: string | null;
  };
}

export interface ScoreLineOut {
  category: ScoreCategory;
  points: number;
  matchId?: string;
  teamId?: string;
  group?: string;
  detail: string;
  provisional?: boolean; // true while derived from a LIVE (not finished) match
}

export interface ParticipantScore {
  participantId: string;
  lines: ScoreLineOut[];
  /** Locked-in points (finished matches / finalized rounds only). */
  lockedPoints: number;
  /** Live-inclusive total shown on the leaderboard (includes LIVE provisional). */
  livePoints: number;
  /** Safe upper bound on the final total given what is still undecided. */
  maxPossible: number;
}
