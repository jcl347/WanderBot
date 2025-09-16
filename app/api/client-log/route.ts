import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { scope, message, digest, stack, extra } = body || {};
    // This console.error is what shows up in Vercel function logs
    // eslint-disable-next-line no-console
    console.error("[client-log]", { scope, message, digest, stack, extra });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[client-log] failed", e?.message || e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
