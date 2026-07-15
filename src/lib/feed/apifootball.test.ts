import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFootballProvider, apiFootballErrors } from "./apifootball";

describe("apiFootballErrors", () => {
  it("treats an empty array (the success shape) as no error", () => {
    expect(apiFootballErrors([])).toEqual([]);
  });
  it("treats a missing field as no error", () => {
    expect(apiFootballErrors(undefined)).toEqual([]);
  });
  it("surfaces the rate-limit object shape", () => {
    expect(
      apiFootballErrors({ requests: "You have reached the request limit for the day" }),
    ).toEqual(["You have reached the request limit for the day"]);
  });
  it("surfaces multiple messages", () => {
    expect(apiFootballErrors({ token: "invalid", plan: "not allowed" })).toEqual([
      "invalid",
      "not allowed",
    ]);
  });
});

describe("ApiFootballProvider.fetchFixtures", () => {
  const provider = new ApiFootballProvider("test-key");
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    );

  // The core regression: a quota-exhausted feed answers HTTP 200 with an error
  // envelope and an empty response. It must THROW, not return [] — a silent []
  // no-ops the sync and freezes the board with monitors still green.
  it("throws on a soft error (HTTP 200 + populated errors), never returns []", async () => {
    stubFetch({ errors: { requests: "You have reached the request limit for the day" }, response: [] });
    await expect(provider.fetchFixtures()).rejects.toThrow(/request limit/);
  });

  // Wrong league/season (or a key without access) answers 200 with errors:[]
  // and an empty response. A whole-season query must never be legitimately
  // empty, so this must THROW rather than silently no-op the sync.
  it("throws on an empty response (no date filter — the season is never empty)", async () => {
    stubFetch({ errors: [], results: 0, response: [] });
    await expect(provider.fetchFixtures()).rejects.toThrow(/0 fixtures/);
  });

  // The fixtures endpoint REJECTS a `page` parameter ("The Page field do not
  // exist" — verified against the live API 2026-07-15). Never send one.
  it("does not send a page parameter (the endpoint rejects it)", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(
          JSON.stringify({ errors: [], results: 1, paging: { current: 1, total: 1 }, response: [
            {
              fixture: { id: 1, date: "2026-06-11T19:00:00Z", status: { short: "FT" }, venue: { name: null, city: null } },
              teams: { home: { id: 1, name: "Mexico", winner: true }, away: { id: 2, name: "Croatia", winner: false } },
              goals: { home: 2, away: 1 },
            },
          ] }),
          { status: 200 },
        );
      }),
    );
    await provider.fetchFixtures();
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0]).searchParams.has("page")).toBe(false);
  });

  // If the API ever reports more pages than the one response, a partial list
  // must fail loud — silently dropping the tail would freeze the final rounds.
  it("throws when the API reports a multi-page result", async () => {
    stubFetch({
      errors: [],
      results: 100,
      paging: { current: 1, total: 2 },
      response: [
        {
          fixture: { id: 1, date: "2026-06-11T19:00:00Z", status: { short: "FT" }, venue: { name: null, city: null } },
          teams: { home: { id: 1, name: "Mexico", winner: true }, away: { id: 2, name: "Croatia", winner: false } },
          goals: { home: 2, away: 1 },
        },
      ],
    });
    await expect(provider.fetchFixtures()).rejects.toThrow(/partial fixture list/);
  });

  it("parses fixtures when the call actually succeeds (errors: [])", async () => {
    stubFetch({
      errors: [],
      results: 1,
      response: [
        {
          fixture: { id: 42, date: "2026-07-11T19:00:00Z", status: { short: "FT" }, venue: { name: "Stadium", city: "City" } },
          teams: {
            home: { id: 1, name: "England", winner: false },
            away: { id: 2, name: "Norway", winner: true },
          },
          goals: { home: 1, away: 2 },
        },
      ],
    });
    const fixtures = await provider.fetchFixtures();
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({
      externalRef: "apifootball:42",
      status: "FINISHED",
      homeName: "England",
      awayName: "Norway",
      winnerName: "Norway",
      venue: "Stadium, City",
    });
  });
});
