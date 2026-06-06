// End-to-end settlement dry-run against the local DB.
// Creates throwaway participants + results, settles, asserts, then resets clean.
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
  const id = (code: string) => {
    const t = teams.find((x) => x.code === code);
    if (!t) throw new Error(`no team ${code}`);
    return t.id;
  };

  const groupA = await prisma.match.findMany({
    where: { stage: "GROUP", group: "A" },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  const matchOf = (homeCode: string, awayCode: string) => {
    const m = groupA.find(
      (x) => x.homeTeamId === id(homeCode) && x.awayTeamId === id(awayCode),
    );
    if (!m) throw new Error(`no match ${homeCode} v ${awayCode}`);
    return m.id;
  };

  // --- results: MEX win group, KOR 2nd, CZE 3rd, RSA 4th -------------------
  const results: [string, string, number, number][] = [
    ["MEX", "RSA", 2, 0],
    ["KOR", "CZE", 1, 0],
    ["CZE", "RSA", 1, 1],
    ["MEX", "KOR", 1, 0],
    ["RSA", "KOR", 0, 2],
    ["CZE", "MEX", 0, 1],
  ];
  const touched: string[] = [];
  for (const [h, a, hs, as_] of results) {
    const mid = matchOf(h, a);
    touched.push(mid);
    await prisma.match.update({
      where: { id: mid },
      data: { homeScore: hs, awayScore: as_, status: "FINISHED" },
    });
  }

  // --- participants --------------------------------------------------------
  const alice = await prisma.participant.create({
    data: { name: "__dryrun_alice", slug: "__dryrun_alice" },
  });
  const bob = await prisma.participant.create({
    data: { name: "__dryrun_bob", slug: "__dryrun_bob" },
  });

  // Alice: exact group A standings (MEX 1st, KOR 2nd) + two match picks.
  await prisma.groupStandingPick.createMany({
    data: [
      { participantId: alice.id, group: "A", position: 1, teamId: id("MEX") },
      { participantId: alice.id, group: "A", position: 2, teamId: id("KOR") },
    ],
  });
  await prisma.groupMatchPick.createMany({
    data: [
      { participantId: alice.id, matchId: matchOf("MEX", "RSA"), predHome: 2, predAway: 0 }, // exact -> 4
      { participantId: alice.id, matchId: matchOf("KOR", "CZE"), predHome: 2, predAway: 1 }, // result -> 2
    ],
  });
  // A final pick (all undecided) — should add 160+40+40 = 240 to her ceiling.
  await prisma.finalPick.create({
    data: {
      participantId: alice.id,
      championTeamId: id("BRA"),
      runnerUpTeamId: id("FRA"),
      thirdPlaceTeamId: id("ARG"),
    },
  });

  // Bob: top-2 right but slots swapped (KOR 1st, MEX 2nd) -> 10, no bonuses.
  await prisma.groupStandingPick.createMany({
    data: [
      { participantId: bob.id, group: "A", position: 1, teamId: id("KOR") },
      { participantId: bob.id, group: "A", position: 2, teamId: id("MEX") },
    ],
  });

  // --- settle --------------------------------------------------------------
  const res = await settle("dryrun");
  console.log("settle:", res);

  const standings = await prisma.standing.findMany();
  const aS = standings.find((s) => s.participantId === alice.id)!;
  const bS = standings.find((s) => s.participantId === bob.id)!;

  console.log("\nAssertions:");
  check("Alice total = 21 (6 match + 15 advancement)", aS.totalPoints === 21, `got ${aS.totalPoints}`);
  check("Bob total = 10 (two advancers, no bonus)", bS.totalPoints === 10, `got ${bS.totalPoints}`);
  check("Alice rank 1", aS.rank === 1, `got ${aS.rank}`);
  check("Bob rank 2", bS.rank === 2, `got ${bS.rank}`);
  check("Alice maxPossible = 21 + 240 (final still open)", aS.maxPossible === 261, `max ${aS.maxPossible}`);

  const aLines = await prisma.scoreLine.findMany({ where: { participantId: alice.id } });
  const cats = aLines.map((l) => l.category).sort();
  check(
    "Alice has 2 match + 2 advance + winner + runnerup lines",
    JSON.stringify(cats) ===
      JSON.stringify(
        ["GROUP_ADVANCE", "GROUP_ADVANCE", "GROUP_MATCH", "GROUP_MATCH", "GROUP_RUNNERUP_BONUS", "GROUP_WINNER_BONUS"].sort(),
      ),
    cats.join(","),
  );

  const ga = await prisma.groupStandingActual.findMany({ where: { group: "A" }, orderBy: { position: "asc" } });
  const order = ga.map((g) => teams.find((t) => t.id === g.teamId)!.code).join(">");
  check("Derived group A order = MEX>KOR>CZE>RSA", order === "MEX>KOR>CZE>RSA", order);

  const bestThirds = await prisma.bestThirdActual.count();
  check("Best thirds NOT finalized (only group A done)", bestThirds === 0, `got ${bestThirds}`);

  // --- cleanup: remove test data, reset matches, re-settle to clean state --
  await prisma.participant.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
  await prisma.match.updateMany({
    where: { id: { in: touched } },
    data: { homeScore: null, awayScore: null, winnerTeamId: null, status: "SCHEDULED" },
  });
  await settle("dryrun-reset");
  const left = {
    participants: await prisma.participant.count(),
    scoreLines: await prisma.scoreLine.count(),
    standings: await prisma.standing.count(),
    groupActuals: await prisma.groupStandingActual.count(),
  };
  check("Clean reset (no residual test data)", Object.values(left).every((v) => v === 0), JSON.stringify(left));

  console.log(failures === 0 ? "\nDRY-RUN PASSED ✅" : `\nDRY-RUN FAILED ❌ (${failures})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
