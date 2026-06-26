import Link from "next/link";

// Minimal chrome for the self-serve contestant pick links — just the wordmark,
// no board tabs and no admin nav.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24">
      <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl text-ink sm:text-2xl">
            World Cup <span className="text-lime">&apos;26</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mut">Picks</span>
        </Link>
      </header>
      <main className="pt-6">{children}</main>
    </div>
  );
}
