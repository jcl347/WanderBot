// app/api/images/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Img = { url: string; title?: string; source?: string; license?: string };

async function verifyImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      // A UA greatly reduces throttling on Commons
      headers: { "User-Agent": "WanderBot/1.0 (images endpoint; vercel runtime)" },
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

// One Commons request with a single search expression
async function commonsOnce(expr: string, want: number, reqId: string) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", expr);
  u.searchParams.set("gsrnamespace", "6"); // File: namespace only
  u.searchParams.set("gsrlimit", String(Math.min(50, Math.max(want * 4, 16))));
  u.searchParams.set("iiprop", "url|mime|extmetadata|size");
  u.searchParams.set("iiurlwidth", "1600");
  u.searchParams.set("origin", "*");

  console.log(`[images ${reqId}] commons expr="${expr}" want=${want}`);
  const res = await fetch(u.toString(), {
    cache: "no-store",
    headers: { "User-Agent": "WanderBot/1.0 (images endpoint; vercel runtime)" },
  });
  if (!res.ok) {
    console.log(`[images ${reqId}] commons status=${res.status} expr="${expr}"`);
    return [] as Img[];
  }

  const data = await res.json();
  const pages: any[] = Object.values(data?.query?.pages ?? {});
  const out: Img[] = [];
  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    const url = ii?.thumburl || ii?.url;
    const mime = (ii?.mime ?? "").toLowerCase();
    if (!url || !mime.startsWith("image/")) continue;

    // HEAD verify; if it fails, just skip this file
    const ok = await verifyImage(url);
    if (!ok) continue;

    out.push({
      url,
      title: p?.title,
      source:
        "https://commons.wikimedia.org/wiki/" +
        encodeURIComponent(p?.title || ""),
      license: ii?.extmetadata?.LicenseShortName?.value,
    });
    if (out.length >= want) break;
  }
  console.log(
    `[images ${reqId}] commons verified=${out.length}/${want} expr="${expr}"`
  );
  return out;
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({} as any));

    // You can send either:
    //  - { terms: string[], city?: string, count?: number }
    //  - { q: string, count?: number }  (legacy)
    const city: string = String(body?.city || "").trim();
    const count = Math.max(1, Math.min(Number(body?.count ?? 12), 30));

    const terms: string[] = Array.isArray(body?.terms)
      ? body.terms.map((s: any) => String(s || "").trim()).filter(Boolean)
      : [];

    const q = String(body?.q ?? "").trim();
    const searchTerms = terms.length ? terms : (q ? [q] : []);

    if (!searchTerms.length) {
      console.log(`[images ${reqId}] missing q/terms`);
      return NextResponse.json({ images: [] });
    }

    console.log(
      `[images ${reqId}] request count=${count} city="${city}" terms=`,
      searchTerms.slice(0, 10)
    );

    // Build up results in small chunks per term, with multiple strategies
    const results: Img[] = [];
    const seen = new Set<string>();

    for (const term of searchTerms) {
      if (results.length >= count) break;

      // Strategy A: plain phrase, bias away from non-photos
      // e.g., "Miami Wynwood Walls -svg -icon -map"
      const plain = `${city ? `${city} ` : ""}${term} -svg -icon -map`;

      // Strategy B: allintitle:"<city term>"
      const titl =
        city ? `allintitle:"${city} ${term}"` : `allintitle:"${term}"`;

      // Strategy C: city-first fallback or just the term alone
      const fallback = city ? `${city} ${term}` : term;

      const needed = Math.min(6, count - results.length);
      const batches = [
        await commonsOnce(plain, needed, reqId),
        results.length < count ? await commonsOnce(titl, needed, reqId) : [],
        results.length < count ? await commonsOnce(fallback, needed, reqId) : [],
      ];

      for (const batch of batches) {
        for (const im of batch) {
          if (!seen.has(im.url)) {
            seen.add(im.url);
            results.push(im);
            if (results.length >= count) break;
          }
        }
        if (results.length >= count) break;
      }
    }

    console.log(`[images ${reqId}] total_returned=${results.length}`);
    return NextResponse.json({ images: results });
  } catch (e: any) {
    console.error(`[images ${reqId}] fatal:`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
