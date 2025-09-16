// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "wander_profile";

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(COOKIE)?.value;
  try {
    const data = raw ? JSON.parse(raw) : null;
    return NextResponse.json(data || {});
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: JSON.stringify(body || {}),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
