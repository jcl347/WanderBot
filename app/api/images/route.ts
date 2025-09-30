// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Img = { url: string; title?: string; source: "wikimedia" | "openverse" };

// --- helpers ---
function okImages(images: Img[], max = 40): Img[] {
  const seen = new Set<string>();
  const out: Img[] = [];
  for (const im of images) {
    const key = im.url.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(im);
    if (out.length >= max) break;
  }
  return out;
}

async function fetchWikimedia(term: string, limit: number): Promise<Img[]> {
  if (!term) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    generator: "search",
    gsrnamespace: "6", // File namespace
    gsrsearch: term,
    gsrlimit: String(Math.min(20, Math.max(5, limit))),
    iiprop: "url|mime",
    iiurlwidth: "1280",
    origin: "*",
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const pages = json?.query?.pages || {};
    const imgs: Img[] = Object.values(pages)
      .map((p: any) => {
        const ii = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
        const link = ii?.thumburl || ii?.url;
        if (!link) return null;
        return { url: link as string, title: p?.title, source: "wikimedia" as const };
      })
      .filter(Boolean);
    return imgs.slice(0, limit);
  } catch {
    return [];
  }
}

async function fetchOpenverse(term: string, limit: number): Promise<Img[]> {
  if (!term) return [];
  const params = new URLSearchParams({
    q: term,
    page_size: String(Math.min(50, Math.max(5, limit * 2))),
    fields: "thumbnail,url,title,source,provider",
  });
  const url = `https://api.openverse.engineering/v1/images/?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const results: any[] = Array.isArray(json?.results) ? json.results : [];
    const imgs: Img[] = results
      .map((r) => {
        // Prefer Openverse CDN thumbnail (whitelisted in next.config), else source URL.
        const link: string | undefined = r?.thumbnail || r?.url;
        if (!link) return null;
        return {
          url: link,
          title: r?.title || r?.source || r?.provider,
          source: "openverse" as const,
        };
      })
      .filter(Boolean);
    return imgs.slice(0, limit);
  } catch {
    return [];
  }
}

function parseTerms(inputQ?: string, inputTerms?: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(inputTerms)) {
    for (const t of inputTerms) {
      if (typeof t === "string" && t.trim()) out.push(t.trim());
    }
  }
  if (typeof inputQ === "string" && inputQ.trim()) {
    for (const t of inputQ.split(",").map((s) => s.trim())) {
      if (t) out.push(t);
    }
  }
  // de-dupe
  return Array.from(new Set(out)).slice(0, 12);
}

// A small opinionated booster for “vacation-y” searches
function enrichVacationTerms(terms: string[]): string[] {
  const flavor = [
    "sunset", "golden hour", "beach", "rooftop pool", "old town",
    "harbor promenade", "market street food", "nightlife", "boardwalk",
    "waterfront", "viewpoint", "coastline", "hiking trail", "waterfall",
  ];
  const out: string[] = [];
  for (const t of terms) {
    // If term already includes a city, append a few vacation vibes
    if (/\b[a-z]+\s+[a-z]+/i.test(t)) {
      for (const f of flavor) out.push(`${t} ${f}`);
      out.push(t);
    } else {
      out.push(t);
    }
    if (out.length > 40) break;
  }
  return Array.from(new Set(out));
}

async function searchAll(terms: string[], count: number): Promise<Img[]> {
  const boosted = enrichVacationTerms(terms);
  const perTerm = Math.max(4, Math.ceil(count / Math.max(1, Math.min(terms.length, 6))));
  const batches = boosted.slice(0, 10).map(async (t) => {
    const a = await fetchWikimedia(t, perTerm);
    if (a.length >= perTerm) return a;
    const b = await fetchOpenverse(t, perTerm - a.length);
    return [...a, ...b];
  });
  const chunks = await Promise.all(batches);
  const flat = chunks.flat();
  return okImages(flat, Math.max(3, Math.min(60, count)));
}

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}

// --- GET /api/images?q=...&count=... ---
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") || undefined;
  const count = Number(searchParams.get("count") || "24");
  const terms = parseTerms(q, undefined);
  if (!terms.length) return json({ images: [] }, 200);

  const images = await searchAll(terms, count);
  // Server log for debugging
  console.log("[/api/images GET] terms=", terms, " ->", images.length, "images");
  return json({ images }, 200);
}

// --- POST /api/images  { q?: string, terms?: string[], count?: number } ---
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const q = typeof body?.q === "string" ? body.q : undefined;
  const count = Number(body?.count ?? 24) || 24;
  const terms = parseTerms(q, body?.terms);

  if (!terms.length) {
    return json({ images: [] }, 200);
  }

  const images = await searchAll(terms, count);
  console.log("[/api/images POST] terms=", terms, " ->", images.length, "images");
  return json({ images }, 200);
}
