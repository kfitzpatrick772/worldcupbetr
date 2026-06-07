"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/participants", label: "Players" },
  { href: "/admin/picks", label: "Group picks" },
  { href: "/admin/knockout", label: "Knockout" },
  { href: "/admin/bracket", label: "Bracket" },
  { href: "/admin/results", label: "Results" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <nav className="flex flex-wrap gap-1">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-lime text-black" : "text-mut hover:bg-panel2 hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3">
        <Link href="/" className="font-mono text-[11px] text-mut hover:text-lime" target="_blank">
          View board ↗
        </Link>
        <form action={logout}>
          <button className="font-mono text-[11px] text-mut hover:text-red">Sign out</button>
        </form>
      </div>
    </div>
  );
}
