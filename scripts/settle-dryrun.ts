// End-to-end settlement dry-run against the local DB. Non-destructive and
// independent of any coexisting data (e.g. demo seed): it snapshots the Group A
// matches it touches and restores them afterward, asserts absolute points +
// relative ordering (not absolute rank), and removes only its own players.
// Run: npx tsx scripts/settle-dryrun.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { settle } from "../src/lib/scoring/settle";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
}

async function main() {
  const teams = await prisma.team.findMany({ select: { id: true, code: true } });
  const id = (code: string) => teams.find((x) => x.code === code)!.id;

  const groupA = await prisma.match.findMany({
    where: { stage: "GROUP", group: "A" },
    select: {
      id: true, homeTeamId: true, awayTeamId: true,
      homeScore: true, awayScore: true, winnerTeamId: true, status: true,
    },
  });
  const snapshot = groupA.map((m) => ({
    id: m.id, homeScore: m.homeScore, awayScore: m.awayScore,
    winnerTeamId: m.winnerTeamId, status: m.status as "SCHEDULED" | "LIVE" | "FINISHED",
  }));
  const matchOf = (h: string, a: string) =>
    groupA.find((x) => x.homeTeamId === id(h) && x.awayTeamId === id(a))!.id;

  const results: [string, string, number, number][] = [
    ["MEX", "RSA", 2, 0], ["KOR", "CZE", 1, 0], ["CZE", "RSA", 1, 1],
    ["MEX", "KOR", 1, 0], ["RSA", "KOR", 0, 2], ["CZE", "MEX", 0, 1],
  ];
  for (const [h, a, hs, as_] of results) {
    await prisma.match.update({
      where: { id: matchOf(h, a) },
      data: { homeScore: hs, awayScore: as_, status: "FINISHED" },
    });
  }

  const alice = await prisma.participant.create({ data: { name: "__dryrun_alice", slug: "__dryrun_alice" } });
  const bob = await prisma.participant.create({ data: { name: "__dryrun_bob", slug: "__dryrun_bob" } });

  await prisma.groupStandingPick.createMany({
    data: [
      { participantId: alice.id, group: "A", position: 1, teamId: id("MEX") },
      { participantId: alice.id, group: "A", position: 2, teamId: id("KOR") },
      { participantId: bob.id, group: "A", position: 1, teamId: id("KOR") },
      { participantId: bob.id, group: "A", position: 2, teamId: id("MEX") },
    ],
  });
  await prisma.groupMatchPick.createMany({
    data: [
      { participantId: alice.id, matchId: matchOf("MEX", "RSA"), predHome: 2, predAway: 0 }, // exact 4
      { participantId: alice.id, matchId: matchOf("KOR", "CZE"), predHome: 2, predAway: 1 }, // result 2
    ],
  });
  await prisma.finalPick.create({
    data: {
      participantId: alice.id,
      championTeamId: id("BRA"), runnerUpTeamId: id("FRA"), thirdPlaceTeamId: id("ARG"),
    },
  });

  const res = await settle("dryrun");
  console.log("settle:", res);

  const aS = (await prisma.standing.findUnique({ where: { participantId: alice.id } }))!;
  const bS = (await prisma.standing.findUnique({ where: { participantId: bob.id } }))!;

  console.log("\nAssertions:");
  check("Alice total = 21 (6 match + 15 advancement)", aS.totalPoints === 21, `got ${aS.totalPoints}`);
  check("Bob total = 10 (two advancers, no bonus)", bS.totalPoints === 10, `got ${bS.totalPoints}`);
  check("Alice ranked above Bob", aS.rank < bS.rank, `alice ${aS.rank} bob ${bS.rank}`);
  check("Alice maxPossible = 21 + 240 (final open)", aS.maxPossible === 261, `max ${aS.maxPossible}`);

  const aLines = await prisma.scoreLine.findMany({ where: { participantId: alice.id } });
  const cats = aLines.map((l) => l.category).sort();
  check(
    "Alice has 2 match + 2 advance + winner + runnerup lines",
    JSON.stringify(cats) === JSON.stringify(
      ["GROUP_ADVANCE", "GROUP_ADVANCE", "GROUP_MATCH", "GROUP_MATCH", "GROUP_RUNNERUP_BONUS", "GROUP_WINNER_BONUS"].sort(),
    ),
    cats.join(","),
  );

  const ga = await prisma.groupStandingActual.findMany({ where: { group: "A" }, orderBy: { position: "asc" } });
  const order = ga.map((g) => teams.find((t) => t.id === g.teamId)!.code).join(">");
  check("Derived group A order = MEX>KOR>CZE>RSA", order === "MEX>KOR>CZE>RSA", order);

  // --- restore everything (non-destructive to coexisting data) -------------
  await prisma.participant.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
  for (const s of snapshot) {
    await prisma.match.update({
      where: { id: s.id },
      data: { homeScore: s.homeScore, awayScore: s.awayScore, winnerTeamId: s.winnerTeamId, status: s.status },
    });
  }
  await settle("dryrun-reset");
  const leftovers = await prisma.participant.count({ where: { name: { in: ["__dryrun_alice", "__dryrun_bob"] } } });
  check("Test players removed; Group A restored", leftovers === 0, `leftover ${leftovers}`);

  console.log(failures === 0 ? "\nDRY-RUN PASSED ✅" : `\nDRY-RUN FAILED ❌ (${failures})`);
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
