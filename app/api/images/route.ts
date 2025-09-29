// app/api/images/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  // Keep it simple: an array of short phrases like "Miami South Beach"
  terms: z.array(z.string()).min(1),
  count: z.number().int().min(1).max(30).optional(),
});

// quick HEAD check (defensive)
async function verifyImage(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

type Img = { url: string; title?: string; source?: string; license?: string };

async function commonsSearch(q: string, pageSize: number): Promise<Img[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  // extremely simple query phrase
  u.searchParams.set("gsrsearch", `${q} filetype:bitmap`);
  u.searchParams.set("gsrlimit", String(pageSize));
  u.searchParams.set("iiprop", "url|mime|extmetadata");
  u.searchParams.set("iiurlwidth", "1600");
  u.searchParams.set("origin", "*");

  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  const pages: any[] = Object.values(json?.query?.pages ?? {});
  const out: Img[] = [];
  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    const url = ii?.thumburl || ii?.url;
    const mime = (ii?.mime ?? "").toLowerCase();
    if (!url || !mime.startsWith("image/")) continue;
    out.push({
      url,
      title: p?.title,
      source: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p?.title || ""),
      license: ii?.extmetadata?.LicenseShortName?.value,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Body.parse(body);
    const want = Math.min(24, Math.max(1, parsed.count ?? 16));
    const perTerm = Math.max(6, Math.ceil(want / Math.max(1, parsed.terms.length)));

    console.log(`[images ${reqId}] terms=${parsed.terms.join(" | ")} want=${want} perTerm=${perTerm}`);

    const all: Img[] = [];
    const seen = new Set<string>();

    for (const term of parsed.terms) {
      const results = await commonsSearch(term, perTerm * 4); // oversample, we’ll verify
      for (const r of results) {
        if (!r.url || seen.has(r.url)) continue;
        // light verification but don’t block the world
        if (!(await verifyImage(r.url))) continue;
        seen.add(r.url);
        all.push(r);
        if (all.length >= want) break;
      }
      if (all.length >= want) break;
    }

    console.log(`[images ${reqId}] returned=${all.length}/${want}`);
    return NextResponse.json({ images: all });
  } catch (e: any) {
    console.error(`[images fatal]`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 400 });
  }
}
