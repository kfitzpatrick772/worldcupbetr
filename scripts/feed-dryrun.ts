// Validates the feed pipeline (provider -> match -> apply -> settle) with a FAKE
// provider, so it works without a real API key. Non-destructive: snapshots the
// matches it touches and restores them. Run: npx tsx scripts/feed-dryrun.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { applyFixtures } from "../src/lib/feed/sync";
import type { FeedFixture } from "../src/lib/feed/types";

let failures = 0;
const check = (n: string, c: boolean, x = "") => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${x ? "  — " + x : ""}`);
  if (!c) failures++;
};

async function main() {
  const scheduled = await prisma.match.findMany({
    where: { stage: "GROUP", group: "C", status: "SCHEDULED" },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    take: 2,
  });
  if (scheduled.length < 2) throw new Error("need 2 scheduled group C matches (run demo-seed first)");

  const snap = scheduled.map((m) => ({
    id: m.id, status: m.status, homeScore: m.homeScore, awayScore: m.awayScore,
    externalRef: m.externalRef, kickoff: m.kickoff,
  }));

  // Fake feed: report both as FINISHED, with home/away SWAPPED to test unordered matching.
  const fixtures: FeedFixture[] = scheduled.map((m, i) => ({
    externalRef: `fake:${i}`,
    status: "FINISHED",
    homeName: m.awayTeam!.name, // swapped on purpose
    awayName: m.homeTeam!.name,
    homeScore: 1,
    awayScore: 0,
    kickoff: m.kickoff.toISOString(),
  }));

  const res = await applyFixtures(fixtures);
  console.log("applyFixtures:", res);

  console.log("\nAssertions:");
  check("both fixtures matched", res.matched === 2, `matched ${res.matched}`);
  check("both updated", res.updated === 2, `updated ${res.updated}`);
  check("settle ran", res.settled === true);
  check("no unmatched", res.unmatched.length === 0, JSON.stringify(res.unmatched));

  const after = await prisma.match.findMany({ where: { id: { in: snap.map((s) => s.id) } } });
  check("matches now FINISHED with externalRef", after.every((m) => m.status === "FINISHED" && m.externalRef?.startsWith("fake:")));

  // idempotency: re-apply same feed -> no further updates
  const again = await applyFixtures(fixtures);
  check("re-apply is a no-op (idempotent)", again.updated === 0, `updated ${again.updated}`);

  // restore
  for (const s of snap) {
    await prisma.match.update({
      where: { id: s.id },
      data: { status: s.status, homeScore: s.homeScore, awayScore: s.awayScore, externalRef: s.externalRef, kickoff: s.kickoff },
    });
  }
  await applyFixtures([]); // triggers nothing; settle separately
  const { settle } = await import("../src/lib/scoring/settle");
  await settle("feed-dryrun-reset");
  const restored = await prisma.match.findMany({ where: { id: { in: snap.map((s) => s.id) }, status: "SCHEDULED" } });
  check("matches restored to scheduled", restored.length === 2);

  console.log(failures === 0 ? "\nFEED DRY-RUN PASSED ✅" : `\nFEED DRY-RUN FAILED ❌ (${failures})`);
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
