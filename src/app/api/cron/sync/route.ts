import { timingSafeEqual } from "node:crypto";
import { getProvider, syncFromProvider } from "@/lib/feed";

// Score-feed sync endpoint. A scheduler hits this during matches. Secured by a
// shared CRON_SECRET (Authorization: Bearer <secret>, or ?key=<secret>).
// No-ops when SCORE_PROVIDER=manual (admin enters results by hand).

export const dynamic = "force-dynamic";

// Constant-time compare, tolerant of stray whitespace picked up when the
// secret is pasted into Railway / GitHub secret forms.
function secretMatches(presented: string | null, secret: string): boolean {
  if (!presented) return false;
  const a = Buffer.from(presented.trim());
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const key = new URL(req.url).searchParams.get("key");
  if (!secretMatches(bearer, secret) && !secretMatches(key, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const provider = getProvider();
  if (!provider) {
    return Response.json({ skipped: "manual provider — nothing to sync" });
  }

  try {
    const result = await syncFromProvider(provider);
    // The feed returned fixtures but not one matched our schedule — the board
    // cannot update. Surface it as an error (not a 200) so the scheduler goes
    // red instead of the board silently freezing while the sync "succeeds".
    if (result.fetched > 0 && result.matched === 0) {
      return Response.json(
        {
          error: `feed returned ${result.fetched} fixtures but none matched our schedule — ` +
            `check team-name aliases in src/lib/feed/match.ts`,
          provider: provider.name,
          ...result,
        },
        { status: 502 },
      );
    }
    return Response.json({ provider: provider.name, ...result });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "sync failed" },
      { status: 502 },
    );
  }
}

export const GET = run;
export const POST = run;
