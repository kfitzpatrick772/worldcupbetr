import { getProvider, syncFromProvider } from "@/lib/feed";

// Score-feed sync endpoint. Railway cron hits this on a schedule. Secured by a
// shared CRON_SECRET (Authorization: Bearer <secret>, or ?key=<secret>).
// No-ops when SCORE_PROVIDER=manual (admin enters results by hand).

export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const provider = getProvider();
  if (!provider) {
    return Response.json({ skipped: "manual provider — nothing to sync" });
  }

  try {
    const result = await syncFromProvider(provider);
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
