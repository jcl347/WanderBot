// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge"; // fast & cacheable
export const dynamic = "force-dynamic"; // we control caching via headers

type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
};

type Orientation = "portrait" | "landscape" | "any";

/** Map our rail orientation to Openverse aspect ratios */
function aspectFor(orientation: Orientation): "tall" | "wide" | undefined {
  if (orientation === "portrait") return "tall";
  if (orientation === "landscape") return "wide";
  return undefined;
}

function parseJSONList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of arr) {
    const k = key(a);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

async function searchOpenverse(
  term: string,
  pageSize: number,
  orientation: Orientation
): Promise<Photo[]> {
  const aspect = aspectFor(orientation);
  const url = new URL("https://api.openverse.engineering/v1/images/");
  url.searchParams.set("q", term);
  url.searchParams.set("page_size", String(Math.min(20, Math.max(1, pageSize))));
  if (aspect) url.searchParams.set("aspect_ratio", aspect);
  // favor photographs; still allow broad results
  url.searchParams.set("license_type", "all");
  url.searchParams.set("filter", "safe");

  const res = await fetch(url.toString(), {
    // cache proxy/CDN layer can hold this briefly
    next: { revalidate: 300 },
    headers: { "User-Agent": "trip-planner/1.0 (+images)" },
  });

  if (!res.ok) {
    throw new Error(`Openverse HTTP ${res.status}`);
  }

  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results : [];

  const photos: Photo[] = results
    .map((r: any) => {
      const src: string | undefined = r?.thumbnail || r?.url;
      const width: number = Number(r?.width) || 1024;
      const height: number = Number(r?.height) || 683;
      const alt: string | undefined = typeof r?.title === "string" ? r.title : undefined;
      if (!src || typeof src !== "string") return null;
      return {
        id: String(r?.id || src),
        src,
        width,
        height,
        alt,
      } as Photo;
    })
    .filter(Boolean);

  return photos;
}

function okJSON(data: any, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // short browser cache, longer CDN cache; allow stale while we refresh
      "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
      ...extraHeaders,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // inputs
    const termsRaw = parseJSONList(searchParams.get("terms"));
    const count = Math.min(60, Math.max(6, Number(searchParams.get("count")) || 18));
    const orientationParam = String(searchParams.get("orientation") || "portrait").toLowerCase();
    const orientation: Orientation =
      orientationParam === "landscape"
        ? "landscape"
        : orientationParam === "any"
        ? "any"
        : "portrait";

    // guard
    const terms = uniqBy(
      (termsRaw.length ? termsRaw : ["travel city skyline"]).map((t) => t.trim()),
      (x) => x.toLowerCase()
    ).slice(0, 12);

    // distribute requests: get ~even results per term
    const perTerm = Math.max(2, Math.ceil(count / Math.max(1, terms.length)));

    // fetch in parallel (cap concurrency a bit)
    const batches: Promise<Photo[]>[] = terms.map((t) => searchOpenverse(t, perTerm, orientation));
    const resultsSettled = await Promise.allSettled(batches);

    const flattened: Photo[] = resultsSettled.flatMap((r) =>
      r.status === "fulfilled" ? r.value : []
    );

    // de-dupe by src & trim to target count
    const images: Photo[] = uniqBy(flattened, (p) => p.src).slice(0, count);

    // minimal fallback if nothing came back
    if (images.length === 0) {
      const fallback: Photo = {
        id: "fallback",
        src: "https://static.openverse.engineering/thumbnails/cc-cat.jpg",
        width: 1024,
        height: 683,
        alt: "Travel",
      };
      return okJSON([fallback]);
    }

    return okJSON(images);
  } catch (err: any) {
    const message = err?.message || "Unexpected error";
    return new NextResponse(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
}

// Some environments send HEAD/OPTIONS before GET; keep them happy.
export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
