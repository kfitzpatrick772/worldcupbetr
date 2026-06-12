// Pure logic to link a provider's fixture to one of our seeded matches.
// Robust to name variants (Korea Republic / South Korea, Türkiye / Turkey, ...)
// and to home/away ordering differences.

const SYNONYMS: Record<string, string> = {
  southkorea: "korearepublic",
  korea: "korearepublic",
  republicofkorea: "korearepublic",
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  cotedivoire: "ivorycoast",
  turkiye: "turkey",
  czechrepublic: "czechia",
  bosniaandherzegovina: "bosniaherzegovina",
  bosnia: "bosniaherzegovina",
  congodr: "drcongo",
  democraticrepublicofthecongo: "drcongo",
  caboverde: "capeverde",
  capeverdeislands: "capeverde", // api-football's name for Cape Verde
  iranislamicrepublic: "iran",
};

export function normalizeName(name: string): string {
  const stripped = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritics
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
  return SYNONYMS[stripped] ?? stripped;
}

function pairKey(a: string, b: string): string {
  return [normalizeName(a), normalizeName(b)].sort().join("__");
}

export interface IndexableMatch {
  id: string;
  externalRef: string | null;
  homeName: string;
  awayName: string;
  kickoff: Date;
}

/** Match a feed fixture to one of our matches: by externalRef, else by the
 *  unordered team pair (closest kickoff if a pair somehow repeats). */
export function matchFixture(
  fixture: { externalRef: string; homeName: string; awayName: string; kickoff?: string },
  ours: IndexableMatch[],
): string | null {
  const byRef = ours.find((m) => m.externalRef && m.externalRef === fixture.externalRef);
  if (byRef) return byRef.id;

  const key = pairKey(fixture.homeName, fixture.awayName);
  const candidates = ours.filter((m) => pairKey(m.homeName, m.awayName) === key);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  // disambiguate by nearest kickoff
  const t = fixture.kickoff ? new Date(fixture.kickoff).getTime() : NaN;
  if (Number.isNaN(t)) return candidates[0].id;
  return candidates
    .map((m) => ({ id: m.id, d: Math.abs(m.kickoff.getTime() - t) }))
    .sort((a, b) => a.d - b.d)[0].id;
}
