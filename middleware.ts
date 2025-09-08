// middleware.ts (Edge-safe)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "wander_uid";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // If cookie already exists, do nothing
  if (req.cookies.get(COOKIE_NAME)?.value) return res;

  // ✅ Use Web Crypto in Edge runtime
  const uid =
    (globalThis as any).crypto?.randomUUID?.() ??
    // tiny fallback (very unlikely to hit, but keeps dev unblocked)
    Math.random().toString(36).slice(2) + Date.now().toString(36);

  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set(COOKIE_NAME, uid, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
