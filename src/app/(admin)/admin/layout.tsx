import { getSession } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";

// Chrome only. Real auth checks live in each page/action (Next 16 layouts don't
// re-render on client navigation, so they're not a security boundary).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {session && <AdminNav />}
      {children}
    </div>
  );
}
