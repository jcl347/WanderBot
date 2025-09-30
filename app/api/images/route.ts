// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Small helper: truncate long strings safely in logs
const short = (s: string, n = 160) =>
  (s || "").slice(0, n) + ((s || "").length > n ? " …[trunc]" : "");

// Parse "terms" from either GET query or POST body.
// Supports: /api/images?terms=a&terms=b OR /api/images?terms=a,b OR POST {terms:[...] }
async function parseInput(req: NextRequest) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.getAll("terms");
  const csv = url.searchParams.get("q") || url.searchParams.get("csv");
  let terms: string[] = [];
  if (fromQuery.length) terms = fromQuery;
  if (csv) terms.push(...String(csv).split(","));
  terms = terms.map((t) => t.trim()).filter(Boolean);

  // POST body wins if present
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (Array.isArray(body?.terms)) {
        terms = body.terms.map((t: unknown) =>
          typeof t === "string" ? t.trim() : ""
        ).filter(Boolean);
      }
    } catch {
      // ignore
    }
  }

  // de-dupe & cap
  terms = Array.from(new Set(terms)).slice(0, 20);

  // count (default 18), per term fetch is ceil(count/terms)
  const countParam =
    (req.method === "POST" ? undefined : url.searchParams.get("count")) ??
    undefined;
  const bodyCount =
    req.method === "POST"
      ? (() => {
          try {
            // will be re-parsed above if valid JSON; ignore errors
            return undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined;

  const count = Math.max(
    1,
    Math.min(
      48,
      Number(
        (bodyCount as any) ??
          countParam ??
          (url.searchParams.get("limit") || 18)
      ) || 18
    )
  );

  return { terms, count };
}

type CommonsImage = {
  src: string; // direct image (or thumb) url
  width?: number | null;
  height?: number | null;
  title?: string | null;
  page?: string | null;
  author?: string | null;
  license?: string | null;
};

// Fetch from Wikimedia Commons using generator=search in File namespace (6).
async function commonsSearch(term: string, limit: number): Promise<CommonsImage[]> {
  // We ask Commons to render a sized thumbnail for speed; original URLs are also in extmetadata if needed.
  // Notes:
  //  - origin=* is required for CORS from browsers; harmless server-side.
  //  - iiurlwidth picks a good rail size; tweak as desired.
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: term,
    gsrlimit: String(limit),
    gsrnamespace: "6", // File namespace
    prop: "imageinfo|info",
    inprop: "url",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    uselang: "en",
  });

  const endpoint = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  const res = await fetch(endpoint, {
    // Caching: let the Edge/CDN hold onto results a bit
    headers: { "User-Agent": "trip-planner/1.0 (image prefetch)" },
    next: { revalidate: 300 }, // 5 minutes
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[/api/images] Commons fetch error:", res.status, short(text));
    return [];
  }

  const json = await res.json().catch(() => ({} as any));
  const pages = json?.query?.pages || {};
  const out: CommonsImage[] = [];

  for (const key of Object.keys(pages)) {
    const p = pages[key];
    const ii = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
    const thumb = ii?.thumburl || ii?.url;
    const width = Number(ii?.thumbwidth || ii?.width) || null;
    const height = Number(ii?.thumbheight || ii?.height) || null;

    // Filter to web-friendly formats (jpg/jpeg/png/webp)
    const ok = typeof thumb === "string" && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(thumb);
    if (!ok) continue;

    out.push({
      src: thumb,
      width,
      height,
      title: typeof p?.title === "string" ? p.title : null,
      page:
        typeof p?.fullurl === "string"
          ? p.fullurl
          : `https://commons.wikimedia.org/wiki/${encodeURIComponent(
              p?.title || ""
            )}`,
      author:
        ii?.extmetadata?.Artist?.value
          ?.replace(/<[^>]+>/g, "")
          ?.trim() || null,
      license:
        ii?.extmetadata?.LicenseShortName?.value?.trim() ||
        ii?.extmetadata?.License?.value?.trim() ||
        null,
    });
  }

  return out;
}

function jsonWithCache(payload: any, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(payload, {
    headers: {
      // Cache a minute on client, 10m on CDN; allow SWR
      "Cache-Control":
        "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
      ...extraHeaders,
    },
  });
}

export async function GET(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  const { terms, count } = await parseInput(req);

  if (!terms.length) {
    console.warn(`[images ${reqId}] No terms provided`);
    return jsonWithCache({ images: [], debug: { reqId, terms, reason: "no-terms" } });
  }

  const perTerm = Math.max(1, Math.ceil(count / terms.length));

  console.log(`[images ${reqId}] terms=${JSON.stringify(terms)} count=${count} perTerm=${perTerm}`);

  // Query all terms in parallel
  const results = await Promise.all(
    terms.map(async (t) => {
      const imgs = await commonsSearch(t, perTerm);
      console.log(
        `[images ${reqId}] term="${t}" -> ${imgs.length} images (sample=${short(imgs[0]?.src || "", 96)})`
      );
      return imgs;
    })
  );

  // Flatten, de-dupe by URL, trim to count
  const flat = results.flat();
  const seen = new Set<string>();
  const images: CommonsImage[] = [];
  for (const im of flat) {
    if (!im?.src || seen.has(im.src)) continue;
    seen.add(im.src);
    images.push(im);
    if (images.length >= count) break;
  }

  if (!images.length) {
    console.warn(`[images ${reqId}] ZERO images returned for terms=${JSON.stringify(terms)}`);
  }

  return jsonWithCache({
    reqId,
    images,
    debug: {
      terms,
      countRequested: count,
      countReturned: images.length,
    },
  });
}

export async function POST(req: NextRequest) {
  // Delegate to GET logic after parsing body; this lets the client call POST safely.
  const url = new URL(req.url);
  const { terms, count } = await parseInput(req);
  const qs = new URLSearchParams();
  terms.forEach((t) => qs.append("terms", t));
  qs.set("count", String(count));
  // Re-call our own GET with normalized querystring. (We could inline, but reuse keeps behavior identical.)
  return GET(new NextRequest(`${url.origin}${url.pathname}?${qs.toString()}`));
}
