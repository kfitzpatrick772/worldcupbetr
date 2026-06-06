// DEV-ONLY demo data: 8 players with full picks, groups A & B decided, one LIVE
// match, then settle — so the public board renders with realistic live data.
// Idempotent: wipes prior demo players first. Run: npx tsx scripts/demo-seed.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { settle } from "../src/lib/scoring/settle";

const PLAYERS = ["Kev", "Nick", "Sean", "Jim", "Sam", "Dana", "Alex", "Pat"];

// Rough strength order (favorites first) — drives both demo results and picks.
const STRENGTH = [
  "ESP", "FRA", "ARG", "ENG", "POR", "BRA", "NED", "GER", "BEL", "CRO",
  "MAR", "URU", "MEX", "COL", "USA", "SUI", "JPN", "SEN", "KOR", "ECU",
  "AUS", "CIV", "EGY", "NOR", "AUT", "PAR", "SWE", "IRN", "GHA", "QAT",
  "CAN", "PAN", "RSA", "SCO", "TUN", "UZB", "NZL", "ALG", "JOR", "IRQ",
  "KSA", "HAI", "CPV", "COD", "CUW", "CZE", "BIH", "TUR",
];
const rankOf = (code: string) => {
  const i = STRENGTH.indexOf(code);
  return i === -1 ? 99 : i;
};

// tiny deterministic hash -> small int
function noise(a: string, b: string): number {
  let h = 2166136261;
  for (const ch of a + "|" + b) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 7) - 3;
}

async function main() {
  // wipe prior demo players
  await prisma.participant.deleteMany({ where: { name: { in: PLAYERS } } });

  const teams = await prisma.team.findMany();
  const codeById = new Map(teams.map((t) => [t.id, t.code]));
  const byGroup = new Map<string, typeof teams>();
  for (const t of teams) {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(t);
  }
  const allMatches = await prisma.match.findMany({ where: { stage: "GROUP" } });

  // ---- create players with full picks -------------------------------------
  for (const name of PLAYERS) {
    const p = await prisma.participant.create({
      data: { name, slug: name.toLowerCase() },
    });

    // each player's perceived team ranking (strength + personal noise)
    const perceived = (code: string) => rankOf(code) + noise(name, code);

    // group standings: top 2 of each group by perceived rank
    const standingData: { participantId: string; group: string; position: number; teamId: string }[] = [];
    for (const [g, ts] of byGroup) {
      const ordered = [...ts].sort((a, b) => perceived(a.code) - perceived(b.code));
      standingData.push({ participantId: p.id, group: g, position: 1, teamId: ordered[0].id });
      standingData.push({ participantId: p.id, group: g, position: 2, teamId: ordered[1].id });
    }
    await prisma.groupStandingPick.createMany({ data: standingData });

    // best thirds: the 8 strongest 3rd-ranked teams across groups (perceived)
    const thirds = [...byGroup.values()]
      .map((ts) => [...ts].sort((a, b) => perceived(a.code) - perceived(b.code))[2])
      .sort((a, b) => perceived(a.code) - perceived(b.code))
      .slice(0, 8);
    await prisma.bestThirdPick.createMany({
      data: thirds.map((t) => ({ participantId: p.id, teamId: t.id })),
    });

    // group match picks: stronger (perceived) team wins, varied scoreline
    const matchData = allMatches.map((m) => {
      const hc = codeById.get(m.homeTeamId!)!;
      const ac = codeById.get(m.awayTeamId!)!;
      const diff = perceived(ac) - perceived(hc); // >0 => home stronger
      const base = (Math.abs(noise(name, hc + ac)) % 3); // 0..2
      let predHome = 1, predAway = 1;
      if (diff > 1) { predHome = 1 + (base % 2 ? 1 : 0) + 1; predAway = base % 2; }
      else if (diff < -1) { predAway = 1 + (base % 2 ? 1 : 0) + 1; predHome = base % 2; }
      else { predHome = 1; predAway = 1; }
      return { participantId: p.id, matchId: m.id, predHome, predAway };
    });
    await prisma.groupMatchPick.createMany({ data: matchData });

    // final pick from perceived strongest
    const top = [...teams].sort((a, b) => perceived(a.code) - perceived(b.code));
    await prisma.finalPick.create({
      data: {
        participantId: p.id,
        championTeamId: top[0].id,
        runnerUpTeamId: top[1].id,
        thirdPlaceTeamId: top[2].id,
      },
    });
  }

  // ---- actual results: complete groups A & B, one LIVE match in C ----------
  const setResult = async (
    m: { id: string; homeTeamId: string | null; awayTeamId: string | null },
    hs: number,
    as_: number,
    status: "FINISHED" | "LIVE",
  ) => {
    await prisma.match.update({
      where: { id: m.id },
      data: { homeScore: hs, awayScore: as_, status },
    });
  };

  for (const g of ["A", "B"]) {
    const gm = allMatches.filter((m) => m.group === g);
    for (const m of gm) {
      const hc = codeById.get(m.homeTeamId!)!;
      const ac = codeById.get(m.awayTeamId!)!;
      const diff = rankOf(ac) - rankOf(hc); // >0 => home stronger
      let hs = 1, as_ = 1;
      if (diff > 1) { hs = 2; as_ = 0; }
      else if (diff < -1) { hs = 0; as_ = 2; }
      else { hs = 1; as_ = 1; }
      await setResult(m, hs, as_, "FINISHED");
    }
  }
  // a live match in group C
  const liveC = allMatches.find((m) => m.group === "C");
  if (liveC) await setResult(liveC, 1, 0, "LIVE");

  const res = await settle("demo");
  const standings = await prisma.standing.findMany({
    orderBy: { rank: "asc" },
    include: { participant: true },
  });
  console.log("settle:", res);
  console.log("\nLeaderboard:");
  for (const s of standings) {
    console.log(`  #${s.rank}  ${s.participant.name.padEnd(6)} ${String(s.totalPoints).padStart(4)} pts  (max ${s.maxPossible})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
