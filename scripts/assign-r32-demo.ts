// DEV-ONLY: assign arbitrary teams to the 16 Round-of-32 matches so the phase-2
// knockout bracket entry can be viewed/tested before all groups are decided.
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const teams = await prisma.team.findMany({ orderBy: { code: "asc" } });
  const r32 = await prisma.match.findMany({ where: { stage: "R32" }, orderBy: { slotLabel: "asc" } });
  let i = 0;
  for (const m of r32) {
    await prisma.match.update({
      where: { id: m.id },
      data: { homeTeamId: teams[i++ % teams.length].id, awayTeamId: teams[i++ % teams.length].id },
    });
  }
  console.log(`assigned R32 teams to ${r32.length} matches`);
}

main().then(() => prisma.$disconnect());
