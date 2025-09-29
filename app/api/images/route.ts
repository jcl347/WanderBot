// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Shape expected by LivePhotoPane */
type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
};

type Orientation = "any" | "portrait" | "landscape";

/** Normalize & parse query params */
function parseParams(req: NextRequest) {
  const url = new URL(req.url);
  // "terms" may be comma-separated or JSON array
  let termsRaw = url.searchParams.get("terms") || "";
  let terms: string[] = [];
  try {
    if (termsRaw.trim().startsWith("[")) {
      terms = (JSON.parse(termsRaw) as string[]).filter(Boolean);
    } else {
      terms = termsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch {
    terms = termsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (terms.length === 0) terms = ["travel", "city"];

  const count = Math.min(Math.max(parseInt(url.searchParams.get("count") || "12", 10) || 12, 1), 50);
  const orientation = (url.searchParams.get("orientation") || "any").toLowerCase() as Orientation;

  return { terms: Array.from(new Set(terms)).slice(0, 12), count, orientation };
}

/** Aspect ratio helpers */
function matchesOrientation(w: number, h: number, want: Orientation) {
  if (want === "any") return true;
  if (w <= 0 || h <= 0) return false;
  const r = w / h;
  return want === "portrait" ? r < 0.95 : r >= 0.95;
}

/** Score for simple ranking: prefer orientation match + larger area */
function scoreImage(w: number, h: number, want: Orientation) {
  const match = matchesOrientation(w, h, want) ? 1 : 0;
  const area = Math.max(1, w * h);
  return match * 1_000_000 + Math.log(area); // orientation dominates, area tiebreaks
}

/** Fetch from Openverse (public, no key) */
async function searchOpenverse(term: string, n: number): Promise<Photo[]> {
  // Docs: https://api.openverse.engineering/v1/
  const u = new URL("https://api.openverse.engineering/v1/images/");
  u.searchParams.set("q", term);
  u.searchParams.set("page_size", String(Math.min(30, Math.max(10, n))));
  u.searchParams.set("license_type", "all"); // keep flexible to increase hit rate
  u.searchParams.set("mature", "false");

  const res = await fetch(u.toString(), {
    // Server-to-server; Openverse already sets CORS
    headers: { "User-Agent": "trip-planner/1.0 (nextjs)" },
    // Let upstream cache; we also add our own cache headers on the response
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
  const json = await res.json();

  const items: any[] = Array.isArray(json?.results) ? json.results : [];
  const out: Photo[] = items
    .map((x) => {
      const width = Number(x?.width) || 0;
      const height = Number(x?.height) || 0;
      // Prefer thumbnail (hosted on static.openverse.engineering) when present
      const src: string = x?.thumbnail || x?.url || "";
      if (!src) return null;
      return {
        id: String(x?.id || src),
        src,
        width: width || 1600,
        height: height || 1066,
        alt: x?.title || x?.creator || x?.source || "Photo",
      } as Photo;
    })
    .filter(Boolean) as Photo[];

  return out;
}

/** Fallback: Wikimedia Commons search */
async function searchWikimedia(term: string, n: number): Promise<Photo[]> {
  // API doc: https://www.mediawiki.org/wiki/API:Images
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("origin", "*");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", term);
  u.searchParams.set("gsrlimit", String(Math.min(30, Math.max(10, n))));
  // Return original + a scaled URL
  u.searchParams.set("iiprop", "url|size|mime");
  u.searchParams.set("iiurlwidth", "1600");

  const res = await fetch(u.toString(), {
    headers: { "User-Agent": "trip-planner/1.0 (nextjs)" },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  const json = await res.json();

  const pages = json?.query?.pages || {};
  const out: Photo[] = Object.values(pages)
    .map((p: any) => {
      const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : undefined;
      const src: string = info?.thumburl || info?.url || "";
      const w = Number(info?.thumbwidth || info?.width) || 0;
      const h = Number(info?.thumbheight || info?.height) || 0;
      if (!src || !w || !h) return null;
      return {
        id: String(p?.pageid || src),
        src,
        width: w,
        height: h,
        alt: p?.title?.replace(/^File:/, "") || "Wikimedia image",
      } as Photo;
    })
    .filter(Boolean) as Photo[];

  return out;
}

/** Main handler */
export async function GET(req: NextRequest) {
  try {
    const { terms, count, orientation } = parseParams(req);

    // Query a few best terms to keep latency low
    const topTerms = terms.slice(0, Math.min(6, terms.length));

    // 1) Try Openverse in parallel
    const ov = await Promise.allSettled(
      topTerms.map((t) => searchOpenverse(t, Math.max(20, count)))
    );
    let images: Photo[] = ov
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter(Boolean);

    // 2) If still too few, add Wikimedia fallback
    if (images.length < Math.ceil(count * 0.75)) {
      const wm = await Promise.allSettled(
        topTerms.map((t) => searchWikimedia(t, Math.max(20, count)))
      );
      images.push(
        ...wm.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      );
    }

    // 3) Dedupe by src, rank by orientation + size
    const seen = new Set<string>();
    const unique = images.filter((p) => {
      const key = p.src;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      const sa = scoreImage(a.width, a.height, orientation);
      const sb = scoreImage(b.width, b.height, orientation);
      return sb - sa;
    });

    const final = unique.slice(0, count);

    return NextResponse.json(final, {
      headers: {
        // Cache in browser a minute, CDNs for 10 minutes; allow long stale
        "Cache-Control":
          "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (err: any) {
    console.error("[/api/images] Fatal:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Image search failed" },
      { status: 500 }
    );
  }
}

/** Allow preflight / HEAD so clients don't see 405s in some environments */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control":
        "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
