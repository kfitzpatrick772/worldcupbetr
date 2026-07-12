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
