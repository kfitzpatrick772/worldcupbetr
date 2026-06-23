import { getBracket } from "@/lib/queries";
import { BracketBoard } from "@/components/BracketBoard";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const data = await getBracket();
  return <BracketBoard data={data} />;
}
