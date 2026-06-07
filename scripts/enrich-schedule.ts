// One-off: enrich prisma/seed-data/group-fixtures.json with accurate ET kickoff
// times (-04:00, EDT in effect all tournament) + venues from the published
// schedule. Matches to existing fixtures by group + unordered team pair, keeping
// our home/away orientation. Run: pnpm tsx scripts/enrich-schedule.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// [group, home, away, "MM-DD", "HH:MM" ET, "Stadium, City"]
const NBC: [string, string, string, string, string, string][] = [
  ["A","Mexico","South Africa","06-11","15:00","Estadio Azteca, Mexico City"],
  ["A","South Korea","Czechia","06-11","22:00","Estadio Akron, Guadalajara"],
  ["A","Czechia","South Africa","06-18","12:00","Mercedes-Benz Stadium, Atlanta"],
  ["A","Mexico","South Korea","06-18","21:00","Estadio Akron, Guadalajara"],
  ["A","Czechia","Mexico","06-24","21:00","Estadio Azteca, Mexico City"],
  ["A","South Africa","South Korea","06-24","21:00","Estadio BBVA, Monterrey"],
  ["B","Canada","Bosnia and Herzegovina","06-12","15:00","BMO Field, Toronto"],
  ["B","Qatar","Switzerland","06-13","15:00","Levi's Stadium, SF Bay Area"],
  ["B","Switzerland","Bosnia and Herzegovina","06-18","15:00","SoFi Stadium, Los Angeles"],
  ["B","Canada","Qatar","06-18","18:00","BC Place, Vancouver"],
  ["B","Switzerland","Canada","06-24","15:00","BC Place, Vancouver"],
  ["B","Bosnia and Herzegovina","Qatar","06-24","15:00","Lumen Field, Seattle"],
  ["C","Brazil","Morocco","06-13","18:00","MetLife Stadium, New York/New Jersey"],
  ["C","Haiti","Scotland","06-13","21:00","Gillette Stadium, Boston"],
  ["C","Scotland","Morocco","06-19","18:00","Gillette Stadium, Boston"],
  ["C","Brazil","Haiti","06-19","21:00","Lincoln Financial Field, Philadelphia"],
  ["C","Scotland","Brazil","06-24","18:00","Hard Rock Stadium, Miami"],
  ["C","Morocco","Haiti","06-24","18:00","Mercedes-Benz Stadium, Atlanta"],
  ["D","USA","Paraguay","06-12","21:00","SoFi Stadium, Los Angeles"],
  ["D","Australia","Turkiye","06-13","00:00","BC Place, Vancouver"],
  ["D","USA","Australia","06-19","15:00","Lumen Field, Seattle"],
  ["D","Turkiye","Paraguay","06-19","00:00","Levi's Stadium, SF Bay Area"],
  ["D","Turkiye","USA","06-25","22:00","SoFi Stadium, Los Angeles"],
  ["D","Paraguay","Australia","06-25","22:00","Levi's Stadium, SF Bay Area"],
  ["E","Germany","Curacao","06-14","13:00","NRG Stadium, Houston"],
  ["E","Ivory Coast","Ecuador","06-14","19:00","Lincoln Financial Field, Philadelphia"],
  ["E","Germany","Ivory Coast","06-20","16:00","BMO Field, Toronto"],
  ["E","Ecuador","Curacao","06-20","20:00","Arrowhead Stadium, Kansas City"],
  ["E","Ecuador","Germany","06-25","16:00","MetLife Stadium, New York/New Jersey"],
  ["E","Curacao","Ivory Coast","06-25","16:00","Lincoln Financial Field, Philadelphia"],
  ["F","Netherlands","Japan","06-14","16:00","AT&T Stadium, Dallas"],
  ["F","Sweden","Tunisia","06-14","22:00","Estadio BBVA, Monterrey"],
  ["F","Netherlands","Sweden","06-20","13:00","NRG Stadium, Houston"],
  ["F","Tunisia","Japan","06-20","00:00","Estadio BBVA, Monterrey"],
  ["F","Japan","Sweden","06-25","19:00","AT&T Stadium, Dallas"],
  ["F","Tunisia","Netherlands","06-25","19:00","Arrowhead Stadium, Kansas City"],
  ["G","Iran","New Zealand","06-15","21:00","SoFi Stadium, Los Angeles"],
  ["G","Belgium","Egypt","06-15","15:00","Lumen Field, Seattle"],
  ["G","Belgium","Iran","06-21","15:00","SoFi Stadium, Los Angeles"],
  ["G","New Zealand","Egypt","06-21","21:00","BC Place, Vancouver"],
  ["G","Egypt","Iran","06-26","23:00","Lumen Field, Seattle"],
  ["G","New Zealand","Belgium","06-26","23:00","BC Place, Vancouver"],
  ["H","Spain","Cape Verde","06-15","12:00","Mercedes-Benz Stadium, Atlanta"],
  ["H","Saudi Arabia","Uruguay","06-15","18:00","Hard Rock Stadium, Miami"],
  ["H","Spain","Saudi Arabia","06-21","12:00","Mercedes-Benz Stadium, Atlanta"],
  ["H","Uruguay","Cape Verde","06-21","18:00","Hard Rock Stadium, Miami"],
  ["H","Cape Verde","Saudi Arabia","06-26","20:00","NRG Stadium, Houston"],
  ["H","Uruguay","Spain","06-26","20:00","Estadio Akron, Guadalajara"],
  ["I","France","Senegal","06-16","15:00","MetLife Stadium, New York/New Jersey"],
  ["I","Iraq","Norway","06-16","18:00","Gillette Stadium, Boston"],
  ["I","France","Iraq","06-22","17:00","Lincoln Financial Field, Philadelphia"],
  ["I","Norway","Senegal","06-22","20:00","MetLife Stadium, New York/New Jersey"],
  ["I","Norway","France","06-26","15:00","Gillette Stadium, Boston"],
  ["I","Senegal","Iraq","06-26","15:00","BMO Field, Toronto"],
  ["J","Argentina","Algeria","06-16","21:00","Arrowhead Stadium, Kansas City"],
  ["J","Austria","Jordan","06-16","00:00","Levi's Stadium, SF Bay Area"],
  ["J","Argentina","Austria","06-22","13:00","AT&T Stadium, Dallas"],
  ["J","Jordan","Algeria","06-22","23:00","Levi's Stadium, SF Bay Area"],
  ["J","Algeria","Austria","06-27","22:00","Arrowhead Stadium, Kansas City"],
  ["J","Jordan","Argentina","06-27","22:00","AT&T Stadium, Dallas"],
  ["K","Portugal","DR Congo","06-17","13:00","NRG Stadium, Houston"],
  ["K","Uzbekistan","Colombia","06-17","22:00","Estadio Azteca, Mexico City"],
  ["K","Portugal","Uzbekistan","06-23","13:00","NRG Stadium, Houston"],
  ["K","Colombia","DR Congo","06-23","22:00","Estadio Akron, Guadalajara"],
  ["K","Colombia","Portugal","06-27","19:30","Hard Rock Stadium, Miami"],
  ["K","DR Congo","Uzbekistan","06-27","19:30","Mercedes-Benz Stadium, Atlanta"],
  ["L","England","Croatia","06-17","16:00","AT&T Stadium, Dallas"],
  ["L","Ghana","Panama","06-17","19:00","BMO Field, Toronto"],
  ["L","England","Ghana","06-23","16:00","Gillette Stadium, Boston"],
  ["L","Panama","Croatia","06-23","19:00","BMO Field, Toronto"],
  ["L","Panama","England","06-27","17:00","MetLife Stadium, New York/New Jersey"],
  ["L","Croatia","Ghana","06-27","17:00","Lincoln Financial Field, Philadelphia"],
];

const SYN: Record<string, string> = {
  southkorea: "korearepublic",
  turkiye: "turkey",
  bosniaandherzegovina: "bosniaherzegovina",
  bosnia: "bosniaherzegovina",
  democraticrepublicofcongo: "drcongo",
  congodr: "drcongo",
};
const norm = (n: string) => {
  const s = n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  return SYN[s] ?? s;
};
const pairKey = (g: string, a: string, b: string) => `${g}|${[norm(a), norm(b)].sort().join("_")}`;

const lookup = new Map<string, { kickoff: string; venue: string }>();
for (const [g, h, a, d, t, v] of NBC) {
  lookup.set(pairKey(g, h, a), { kickoff: `2026-${d}T${t}:00-04:00`, venue: v });
}

const path = join(process.cwd(), "prisma", "seed-data", "group-fixtures.json");
const fixtures = JSON.parse(readFileSync(path, "utf8")) as {
  group: string; home: string; away: string; kickoff: string | null; venue?: string;
}[];

let matched = 0;
const misses: string[] = [];
for (const f of fixtures) {
  const hit = lookup.get(pairKey(f.group, f.home, f.away));
  if (hit) {
    f.kickoff = hit.kickoff;
    f.venue = hit.venue;
    matched++;
  } else {
    misses.push(`${f.group}: ${f.home} v ${f.away}`);
  }
}
writeFileSync(path, JSON.stringify(fixtures, null, 2));
console.log(`enriched ${matched}/${fixtures.length} fixtures with ET time + venue`);
if (misses.length) console.log("UNMATCHED:", misses);
