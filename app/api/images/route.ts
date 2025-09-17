// app/api/images/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Utility: HEAD verify it's an image
async function verifyImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

type CommonsImage = {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
  license?: string;
};

async function commonsSearch(q: string, count: number): Promise<CommonsImage[]> {
  const reqId = Math.random().toString(36).slice(2, 8);
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  // We bias to photographic content and get a large set then trim.
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  // Encourage photo-ish results; you can tune this string.
  u.searchParams.set("gsrsearch", `${q} filetype:bitmap`);
  u.searchParams.set("gsrlimit", String(Math.min(50, Math.max(count * 4, 20))));
  u.searchParams.set("iiprop", "url|size|mime|extmetadata");
  u.searchParams.set("iiurlwidth", "1600"); // decent thumbs
  u.searchParams.set("origin", "*");

  console.log(`[images ${reqId}] commons query=`, q);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) {
    console.log(`[images ${reqId}] commons status=`, res.status);
    return [];
  }
  const data = await res.json();
  const pages: any[] = Object.values(data?.query?.pages ?? {});
  console.log(
    `[images ${reqId}] commons raw pages=${pages.length} (pre-filter)`
  );

  const out: CommonsImage[] = [];
  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    const url = ii?.thumburl || ii?.url;
    const mime = (ii?.mime ?? "").toLowerCase();
    if (!url || !mime.startsWith("image/")) continue;

    const item: CommonsImage = {
      url,
      title: p?.title,
      source:
        "https://commons.wikimedia.org/wiki/" +
        encodeURIComponent(p?.title || ""),
      width: ii?.thumbwidth ?? ii?.width,
      height: ii?.thumbheight ?? ii?.height,
      license: ii?.extmetadata?.LicenseShortName?.value,
    };

    // Optional but helpful: HEAD verify once to avoid broken links.
    const ok = await verifyImage(item.url);
    if (!ok) continue;

    out.push(item);
    if (out.length >= count) break;
  }

  console.log(
    `[images ${reqId}] commons verified=${out.length}/${count} (returning)`
  );
  return out;
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({} as any));
    const q = String(body?.q ?? "").trim();
    const count = Number(body?.count ?? 12);
    if (!q) {
      console.log(`[images ${reqId}] missing q`);
      return NextResponse.json({ images: [] });
    }

    const images = await commonsSearch(q, Math.max(1, Math.min(count, 24)));
    return NextResponse.json({ images });
  } catch (e: any) {
    console.error(`[images] error:`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
