import { prisma } from "@/lib/db";

// Lightweight health check for Railway. Verifies DB connectivity and reports
// the deployed commit so external monitors can tell which build is live.
export const dynamic = "force-dynamic";

const sha = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").slice(0, 7) || null;

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up", sha });
  } catch {
    return Response.json({ ok: false, db: "down", sha }, { status: 503 });
  }
}
