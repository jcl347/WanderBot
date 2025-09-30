// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Make sure this isn't statically cached at build time
export const dynamic = "force-dynamic";

type Img = {
  url: string;
  title?: string;
  source: "wikimedia";
};

// -------------- tiny helpers --------------
function parseTerms(q?: string, termsRaw?: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(termsRaw)) {
    for (const t of termsRaw) if (typeof t === "string" && t.trim()) out.push(t.trim());
  }
  if (typeof q === "string" && q.trim()) {
    for (const t of q.split(",").map((s) => s.trim())) if (t) out.push(t);
  }
  // keep unique & sane length
  return Array.from(new Set(out)).slice(0, 12);
}

function dedupeKeepFirst(images: Img[], limit: number): Img[] {
  const seen = new Set<string>();
  const out: Img[] = [];
  for (const im of images) {
    const key = im.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(im);
    if (out.length >= limit) break;
  }
  return out;
}

function json(data: unknown, status = 200, preloadLinks?: string[]): NextResponse {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
  };
  if (preloadLinks && preloadLinks.length) {
    // Multiple Link headers are allowed; combine as a single comma-separated header.
    headers["Link"] = preloadLinks.map((u) => `<${u}>; rel=preload; as=image; crossorigin`).join(", ");
  }
  return new NextResponse(JSON.stringify(data), { status, headers });
}

// -------------- Wikimedia-only fetch --------------
/**
 * Fetch photos from Wikimedia Commons Files namespace for a single term.
 * We request 1280px thumbnails for good balance of quality/weight.
 */
async function fetchWikimedia(term: string, limit: number): Promise<Img[]> {
  if (!term) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    generator: "search",
    gsrnamespace: "6", // File namespace
    gsrsearch: term,
    gsrlimit: String(Math.min(50, Math.max(5, limit))),
    iiprop: "url|mime|size",
    iiurlwidth: "1280",
    uselang: "en",
    origin: "*",
  });

  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const data: any = await res.json();
    const pages: Record<string, any> = data?.query?.pages || {};

    // Build output without nulls
    const out: Img[] = [];
    for (const p of Object.values(pages) as any[]) {
      const ii = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
      const link = typeof ii?.thumburl === "string" ? ii.thumburl : (typeof ii?.url === "string" ? ii.url : "");
      if (!link) continue;

      // Prefer larger thumbs when provided
      out.push({
        url: link,
        title: typeof p?.title === "string" ? p.title : undefined,
        source: "wikimedia",
      });
    }
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

// -------------- orchestrator --------------
/**
 * Query Wikimedia for each term (capped), flatten, dedupe, and trim.
 * For “vacation vibe” relevance while staying Wikimedia-only, we expand each base term
 * into a few scenic variants (beach, sunset, skyline). You can remove/adjust if undesired.
 */
function expandVacationFlairs(terms: string[]): string[] {
  const flairs = ["beach", "sunset", "skyline", "harbor", "old town", "coastline", "viewpoint", "market"];
  const out: string[] = [];
  for (const t of terms) {
    const base = t.trim();
    if (!base) continue;
    out.push(base);
    for (const f of flairs) out.push(`${base} ${f}`);
  }
  // avoid overly huge queries
  return Array.from(new Set(out)).slice(0, 24);
}

async function searchWikimediaOnly(terms: string[], count: number): Promise<Img[]> {
  const expanded = expandVacationFlairs(terms);
  const perTerm = Math.max(4, Math.ceil(count / Math.max(1, Math.min(expanded.length, 8))));

  const batches = expanded.slice(0, 8).map((t) => fetchWikimedia(t, perTerm));
  const chunks = await Promise.all(batches);
  const flat = chunks.flat();
  // Deduplicate and cap count
  return dedupeKeepFirst(flat, Math.max(3, Math.min(60, count)));
}

// -------------- handlers --------------
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") || undefined;
  const count = Number(searchParams.get("count") || "24");
  const preload = Number(searchParams.get("preload") || "8"); // how many to send as Link: preload

  const terms = parseTerms(q, undefined);
  if (!terms.length) return json({ images: [] }, 200);

  const images = await searchWikimediaOnly(terms, count);
  // Preload first few in the browser via Link header
  const preloadLinks = images.slice(0, Math.max(0, Math.min(preload, images.length))).map((im) => im.url);

  console.log("[/api/images GET] terms=", terms, " ->", images.length, "images");
  return json({ images }, 200, preloadLinks);
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore parse errors; treat as empty
  }
  const q = typeof body?.q === "string" ? body.q : undefined;
  const count = Number(body?.count ?? 24) || 24;
  const preload = Number(body?.preload ?? 0) || 0; // POST is usually server-to-server; preload headers optional
  const terms = parseTerms(q, body?.terms);

  if (!terms.length) return json({ images: [] }, 200);

  const images = await searchWikimediaOnly(terms, count);
  const preloadLinks = preload ? images.slice(0, Math.min(preload, images.length)).map((im) => im.url) : undefined;

  console.log("[/api/images POST] terms=", terms, " ->", images.length, "images");
  return json({ images }, 200, preloadLinks);
}
