import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

// The admin is the ONLY login in the system. Stateless signed-cookie session
// (HMAC-SHA256). No DB session table needed for a single privileged user.

export const SESSION_COOKIE = "wcb_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Fail closed in production; allow a loud dev fallback locally.
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set (>=16 chars) in production");
    }
    return "dev-insecure-secret-please-change";
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createToken(): string {
  const body = b64url(JSON.stringify({ role: "admin", exp: Date.now() + MAX_AGE_SECONDS * 1000, n: randomBytes(6).toString("hex") }));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

/** Constant-time check of the submitted password against ADMIN_PASSWORD. */
export function checkPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  // hash both to fixed length so timingSafeEqual never throws on length mismatch
  const a = createHmac("sha256", secret()).update(submitted).digest();
  const b = createHmac("sha256", secret()).update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Read the current session (cached per render). */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifyToken(token) ? { role: "admin" as const } : null;
});

/** Guard for admin pages/actions. Redirects to login if unauthenticated. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function setSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, createToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
