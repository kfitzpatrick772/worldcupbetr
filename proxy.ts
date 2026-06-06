import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 "Proxy" (formerly Middleware). OPTIMISTIC redirect only — the real
// auth check happens in the admin pages/actions via requireAdmin(). We only peek
// for the presence of the session cookie here (no verification, no DB).
const SESSION_COOKIE = "wcb_admin";

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/admin/login";
  const hasCookie = req.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/admin") && !isLogin && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
