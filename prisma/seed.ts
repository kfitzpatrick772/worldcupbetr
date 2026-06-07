import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type SeedTeam = { name: string; code: string; flag: string; group: string };
type SeedFixture = {
  group: string;
  home: string;
  away: string;
  kickoff: string | null;
};

function load<T>(file: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "seed-data", file), "utf8"),
  ) as T;
}

async function main() {
  const teams = load<SeedTeam[]>("teams.json");
  const fixtures = load<SeedFixture[]>("group-fixtures.json");

  console.log(`Seeding ${teams.length} teams...`);
  for (const t of teams) {
    await prisma.team.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name, flag: t.flag, group: t.group },
      update: { name: t.name, flag: t.flag, group: t.group },
    });
  }

  const byName = new Map(
    (await prisma.team.findMany()).map((t) => [t.name, t.id]),
  );

  console.log(`Seeding ${fixtures.length} group fixtures...`);
  let n = 0;
  for (const f of fixtures) {
    const homeTeamId = byName.get(f.home);
    const awayTeamId = byName.get(f.away);
    if (!homeTeamId || !awayTeamId) {
      throw new Error(`Unknown team in fixture: ${f.home} vs ${f.away}`);
    }
    const kickoff = f.kickoff ? new Date(f.kickoff) : new Date("2026-06-11T00:00:00Z");
    await prisma.match.upsert({
      where: {
        fixtureKey: {
          stage: "GROUP",
          group: f.group,
          homeTeamId,
          awayTeamId,
        },
      },
      create: { stage: "GROUP", group: f.group, homeTeamId, awayTeamId, kickoff },
      update: { kickoff },
    });
    n++;
  }
  console.log(`  upserted ${n} fixtures`);

  // Knockout schedule (teams TBD until group stage results / API assign them).
  type SeedKO = {
    slotLabel: string;
    stage: string;
    kickoff: string;
    homeSource: string;
    awaySource: string;
  };
  const knockouts = load<SeedKO[]>("knockout-fixtures.json");
  console.log(`Seeding ${knockouts.length} knockout fixtures...`);
  for (const k of knockouts) {
    await prisma.match.upsert({
      where: { slotLabel: k.slotLabel },
      create: {
        slotLabel: k.slotLabel,
        stage: k.stage as never,
        kickoff: new Date(k.kickoff),
        homeSource: k.homeSource,
        awaySource: k.awaySource,
      },
      update: { kickoff: new Date(k.kickoff), homeSource: k.homeSource, awaySource: k.awaySource },
    });
  }

  // Singletons.
  await prisma.appState.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  await prisma.finalActual.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const counts = {
    teams: await prisma.team.count(),
    matches: await prisma.match.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
