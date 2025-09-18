// app/api/images/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// HEAD verify it's an image (guards broken thumbs)
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

type Img = {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
  license?: string;
};

async function commonsSearch(query: string, want: number): Promise<Img[]> {
  const reqId = Math.random().toString(36).slice(2, 8);

  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  // Keep it SIMPLE: use the raw query (e.g. "Miami South Beach")
  u.searchParams.set("gsrsearch", query);
  // Grab a big page and trim locally
  u.searchParams.set("gsrlimit", String(Math.min(50, Math.max(want * 4, 20))));
  u.searchParams.set("iiprop", "url|size|mime|extmetadata");
  // 1600px thumbs (good quality + not huge)
  u.searchParams.set("iiurlwidth", "1600");
  u.searchParams.set("origin", "*");

  console.log(`[images ${reqId}] commons query="${query}"`);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) {
    console.log(`[images ${reqId}] status=${res.status}`);
    return [];
  }
  const data = await res.json();
  const pages: any[] = Object.values(data?.query?.pages ?? {});
  const out: Img[] = [];

  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    const url = ii?.thumburl || ii?.url;
    const mime = (ii?.mime ?? "").toLowerCase();
    if (!url || !mime.startsWith("image/")) continue;

    // Optional HEAD check to avoid 404 thumbs
    if (!(await verifyImage(url))) continue;

    out.push({
      url,
      title: p?.title,
      source:
        "https://commons.wikimedia.org/wiki/" +
        encodeURIComponent(p?.title || ""),
      width: ii?.thumbwidth ?? ii?.width,
      height: ii?.thumbheight ?? ii?.height,
      license: ii?.extmetadata?.LicenseShortName?.value,
    });
    if (out.length >= want) break;
  }

  console.log(
    `[images ${reqId}] commons returned=${out.length}/${want} for "${query}"`
  );
  return out;
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({} as any));
    const count = Math.max(1, Math.min(Number(body?.count ?? 12), 24));

    // Accept either { q: "Miami South Beach" } OR { queries: ["Miami South Beach", "Miami Nightlife", ...] }
    let queries: string[] = [];
    if (Array.isArray(body?.queries)) {
      queries = body.queries.filter((s: any) => typeof s === "string" && s.trim());
    } else if (typeof body?.q === "string" && body.q.trim()) {
      queries = [body.q.trim()];
    }

    if (!queries.length) {
      console.log(`[images ${reqId}] missing query terms`);
      return NextResponse.json({ images: [] });
    }

    console.log(`[images ${reqId}] try terms=`, queries);
    const images: Img[] = [];
    for (const term of queries) {
      const need = count - images.length;
      if (need <= 0) break;
      const got = await commonsSearch(term, need);
      images.push(...got);
    }

    console.log(`[images ${reqId}] total_returned=${images.length}`);
    return NextResponse.json({ images });
  } catch (e: any) {
    console.error(`[images fatal]`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
