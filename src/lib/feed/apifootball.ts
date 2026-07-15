// API-Football provider (api-sports.io / RapidAPI). Reads fixtures for the
// 2026 World Cup. Plug in APIFOOTBALL_KEY (+ optional APIFOOTBALL_LEAGUE/SEASON)
// via env. Until verified against the live feed, the manual admin path remains
// the source of truth — both flow through the same settlement.
//
// Docs: https://www.api-football.com/documentation-v3#tag/Fixtures

import type { FeedFixture, FeedStatus, ScoreProvider } from "./types";

const BASE = process.env.APIFOOTBALL_BASE || "https://v3.football.api-sports.io";
// World Cup league id on API-Football is 1; season 2026.
const LEAGUE = process.env.APIFOOTBALL_LEAGUE || "1";
const SEASON = process.env.APIFOOTBALL_SEASON || "2026";

// API-Football short statuses -> our model.
function mapStatus(short: string): FeedStatus {
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(short)) return "LIVE";
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(short)) return "FINISHED";
  return "SCHEDULED";
}

interface ApiFixtureRow {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
    venue?: { name: string | null; city: string | null };
  };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

// API-Football always answers HTTP 200 — even for rate-limit, bad key, wrong
// plan, or unknown league/season. The failure shows up in `errors` (an object
// of {reason: message} on failure, an empty array on success) with an empty
// `response`. We MUST inspect it: otherwise a quota-exhausted feed looks
// identical to "no fixtures", the sync silently no-ops, and the board freezes
// with every monitor still green.
interface ApiEnvelope {
  errors?: Record<string, string> | string[];
  results?: number;
  paging?: { current?: number; total?: number };
  response?: ApiFixtureRow[];
}

/** API-Football reports failures in `errors` while still returning HTTP 200.
 *  Returns the human-readable messages, or [] when the call actually succeeded. */
export function apiFootballErrors(errors: ApiEnvelope["errors"]): string[] {
  if (!errors) return [];
  const messages = Array.isArray(errors) ? errors : Object.values(errors);
  return messages.filter((m): m is string => typeof m === "string" && m.length > 0);
}

export class ApiFootballProvider implements ScoreProvider {
  readonly name = "api-football";
  constructor(private readonly key = process.env.APIFOOTBALL_KEY) {}

  async fetchFixtures(): Promise<FeedFixture[]> {
    if (!this.key) throw new Error("APIFOOTBALL_KEY is not set");

    // NOTE: no `page` parameter — the fixtures endpoint rejects it outright
    // ("The Page field do not exist", verified against the live API 2026-07-15).
    // A league+season query returns the whole season in one response.
    const url = `${BASE}/fixtures?league=${LEAGUE}&season=${SEASON}`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": this.key },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`api-football ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as ApiEnvelope;

    // Fail loud on a soft error (HTTP 200 + populated `errors`) instead of
    // treating it as "no fixtures" and silently freezing the board — e.g. an
    // expired plan reports "Free plans do not have access to this season" here
    // while the HTTP status stays 200.
    const errors = apiFootballErrors(json.errors);
    if (errors.length > 0) {
      throw new Error(`api-football error: ${errors.join("; ")}`);
    }

    // If the API ever DOES split this query across pages, refuse to proceed on
    // a partial list rather than silently dropping the tail (which would be the
    // final rounds). Better a red sync naming the problem than a frozen board.
    if ((json.paging?.total ?? 1) > 1) {
      throw new Error(
        `api-football returned page 1 of ${json.paging!.total} — partial fixture list; ` +
          `the provider needs a supported pagination parameter for this endpoint`,
      );
    }

    const rows: ApiFixtureRow[] = json.response ?? [];

    // This query has NO date filter — it asks for the whole league+season, so a
    // correctly configured feed always returns every fixture (100+). Zero rows
    // with no `errors` means a silent misconfiguration (wrong APIFOOTBALL_LEAGUE
    // / APIFOOTBALL_SEASON, or a key with no access to this competition). Treat
    // it as fatal, not as "nothing to update" — otherwise the board freezes with
    // the sync reporting success.
    if (rows.length === 0) {
      throw new Error(
        `api-football returned 0 fixtures for league=${LEAGUE} season=${SEASON} — ` +
          `check APIFOOTBALL_LEAGUE / APIFOOTBALL_SEASON and that the key has access to this competition`,
      );
    }

    return rows.map((r): FeedFixture => {
      const status = mapStatus(r.fixture.status.short);
      let winnerName: string | null = null;
      if (status === "FINISHED") {
        if (r.teams.home.winner) winnerName = r.teams.home.name;
        else if (r.teams.away.winner) winnerName = r.teams.away.name;
      }
      const venue = [r.fixture.venue?.name, r.fixture.venue?.city]
        .filter(Boolean)
        .join(", ");
      return {
        externalRef: `apifootball:${r.fixture.id}`,
        kickoff: r.fixture.date,
        status,
        homeName: r.teams.home.name,
        awayName: r.teams.away.name,
        homeScore: r.goals.home,
        awayScore: r.goals.away,
        winnerName,
        venue: venue || null,
      };
    });
  }
}
