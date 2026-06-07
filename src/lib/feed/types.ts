// Pluggable score-feed abstraction. The ManualProvider (admin entry) is always
// available; an API provider drops in via env. Both flow through the SAME
// settlement path, so a feed can never corrupt scores beyond what a manual
// entry could — and a re-settle always reconciles.

export type FeedStatus = "SCHEDULED" | "LIVE" | "FINISHED";

export interface FeedFixture {
  externalRef: string; // provider's fixture id
  stage?: string; // GROUP | R32 | ... if the provider tells us
  kickoff?: string; // ISO; used to reconcile our seeded kickoff times
  status: FeedStatus;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  // For knockouts decided after a draw, the provider should name the advancer.
  winnerName?: string | null;
  venue?: string | null; // "Stadium, City"
}

export interface ScoreProvider {
  readonly name: string;
  fetchFixtures(): Promise<FeedFixture[]>;
}
