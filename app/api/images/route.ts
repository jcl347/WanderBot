// app/api/images/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Img = { url: string; title?: string; source?: string; license?: string };

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

/**
 * Simple Wikimedia Commons search:
 * - generator=search with filetype:bitmap bias (photos)
 * - returns up to (limit) verified image thumbs
 */
async function commonsSearch(q: string, limit: number, reqId: string): Promise<Img[]> {
  if (!q.trim() || limit <= 0) return [];
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", `${q} filetype:bitmap`);
  // grab a generous pool, we'll verify/dedupe locally
  const want = Math.min(50, Math.max(limit * 4, 20));
  u.searchParams.set("gsrlimit", String(want));
  u.searchParams.set("iiprop", "url|mime|extmetadata|size");
  u.searchParams.set("iiurlwidth", "1600");
  u.searchParams.set("origin", "*");

  console.log(`[images ${reqId}] commons q="${q}" want=${want}`);

  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) {
    console.log(`[images ${reqId}] commons status=${res.status} for q="${q}"`);
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

    // Optional thumb HEAD check to reduce broken images
    if (!(await verifyImage(url))) continue;

    out.push({
      url,
      title: p?.title,
      source:
        "https://commons.wikimedia.org/wiki/" +
        encodeURIComponent(p?.title || ""),
      license: ii?.extmetadata?.LicenseShortName?.value,
    });

    if (out.length >= limit) break;
  }

  console.log(
    `[images ${reqId}] commons verified=${out.length}/${limit} for q="${q}"`
  );
  return out;
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({} as any));
    // Either a single q OR an array of terms
    const q: string = String(body?.q ?? "").trim();
    const terms: string[] = Array.isArray(body?.terms)
      ? body.terms.map((s: any) => String(s || "").trim()).filter(Boolean)
      : [];
    const count = Math.max(1, Math.min(Number(body?.count ?? 12), 30));

    // Build the list of simple searches:
    // - prefer explicit terms[] (micro-itinerary phrases)
    // - else fall back to single q
    const searchTerms = terms.length ? terms : (q ? [q] : []);

    if (!searchTerms.length) {
      console.log(`[images ${reqId}] missing q/terms`);
      return NextResponse.json({ images: [] });
    }

    console.log(
      `[images ${reqId}] request count=${count} terms=`,
      searchTerms.slice(0, 12)
    );

    const found: Img[] = [];
    const seen = new Set<string>();
    const tried: { term: string; got: number }[] = [];

    for (const term of searchTerms) {
      if (found.length >= count) break;
      // Pull a small batch per term so multiple phrases contribute
      const need = Math.min(6, count - found.length);
      const batch = await commonsSearch(term, need, reqId);
      tried.push({ term, got: batch.length });

      for (const im of batch) {
        if (!seen.has(im.url)) {
          seen.add(im.url);
          found.push(im);
          if (found.length >= count) break;
        }
      }
    }

    console.log(
      `[images ${reqId}] total_returned=${found.length} tried=`,
      tried
    );

    return NextResponse.json({ images: found });
  } catch (e: any) {
    console.error(`[images ${reqId}] fatal:`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
