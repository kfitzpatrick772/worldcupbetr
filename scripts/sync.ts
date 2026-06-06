// Score-feed sync as a runnable command (for Railway cron, as an alternative to
// hitting /api/cron/sync). No-ops when SCORE_PROVIDER=manual.
// Run: npm run sync   (or: npx tsx scripts/sync.ts)
import "dotenv/config";
import { getProvider } from "../src/lib/feed";
import { syncFromProvider } from "../src/lib/feed/sync";
import { prisma } from "../src/lib/db";

async function main() {
  const provider = getProvider();
  if (!provider) {
    console.log("SCORE_PROVIDER=manual — nothing to sync.");
    return;
  }
  const res = await syncFromProvider(provider);
  console.log(`[${provider.name}]`, JSON.stringify(res));
  if (res.unmatched.length) {
    console.warn(`⚠ ${res.unmatched.length} unmatched fixtures:`, res.unmatched.slice(0, 5));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
