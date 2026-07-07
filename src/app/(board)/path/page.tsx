import { getPathToTrophy } from "@/lib/queries";
import { PathList } from "@/components/PathToTrophy";

export const dynamic = "force-dynamic";

export default async function PathPage() {
  const data = await getPathToTrophy();
  return (
    <div>
      <h1 className="mb-1 font-display text-3xl text-ink sm:text-4xl">Path to the Trophy</h1>
      <p className="mb-4 text-sm text-mut">
        Who can still win the pool, and exactly what has to happen. Updates after every knockout result.
      </p>
      <PathList data={data} />
    </div>
  );
}
