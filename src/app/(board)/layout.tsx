import Link from "next/link";
import { LiveRefresh } from "@/components/LiveRefresh";
import { TabNav } from "@/components/TabNav";

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24">
      <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-display text-xl text-ink sm:text-2xl">
              World Cup <span className="text-lime">&apos;26</span>
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-mut sm:inline">
              Bracket
            </span>
          </Link>
          <LiveRefresh />
        </div>
        <div className="mt-3">
          <TabNav />
        </div>
      </header>
      <main className="pt-6">{children}</main>
    </div>
  );
}
