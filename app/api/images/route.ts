// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
};

type Orientation = "portrait" | "landscape" | "any";

function ok(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control":
        "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}

function parseJSONList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) {
      return p
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean);
    }
  } catch {}
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

async function searchCommons(term: string, pageSize: number): Promise<Photo[]> {
  // Wikimedia Commons API – search, then get imageinfo with urls/sizes
  // We’ll ask for 1280px variants where possible for good quality in rails.
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("origin", "*");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", term);
  u.searchParams.set("gsrlimit", String(Math.min(20, Math.max(1, pageSize))));
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("iiprop", "url|size");
  u.searchParams.set("iiurlwidth", "1280");

  const res = await fetch(u.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const json = await res.json();

  const pages = json?.query?.pages;
  if (!pages || typeof pages !== "object") return [];

  const photos: Photo[] = [];
  for (const key of Object.keys(pages)) {
    const p = pages[key];
    const ii = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
    const url: string | undefined = ii?.responsiveUrls?.[0]?.src || ii?.url;
    const width = Number(ii?.width) || 1024;
    const height = Number(ii?.height) || 683;
    if (!url) continue;
    photos.push({
      id: String(p?.pageid || url),
      src: url,
      width,
      height,
      alt: typeof p?.title === "string" ? p.title : undefined,
    });
  }
  return photos;
}

async function searchOpenverse(
  term: string,
  pageSize: number,
  orientation: Orientation
): Promise<Photo[]> {
  const u = new URL("https://api.openverse.engineering/v1/images/");
  u.searchParams.set("q", term);
  u.searchParams.set("page_size", String(Math.min(20, Math.max(1, pageSize))));
  // Rough orientation hint
  if (orientation === "portrait") u.searchParams.set("aspect_ratio", "tall");
  else if (orientation === "landscape") u.searchParams.set("aspect_ratio", "wide");
  u.searchParams.set("license_type", "all");
  u.searchParams.set("filter", "safe");

  const res = await fetch(u.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json?.results) ? json.results : [];

  return arr
    .map((r: any) => {
      const src: string | undefined = r?.thumbnail || r?.url;
      const width: number = Number(r?.width) || 1024;
      const height: number = Number(r?.height) || 683;
      if (!src) return null;
      return {
        id: String(r?.id || src),
        src,
        width,
        height,
        alt: typeof r?.title === "string" ? r.title : undefined,
      } as Photo;
    })
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const termsRaw = parseJSONList(searchParams.get("terms"));
    const terms = uniqBy(
      (termsRaw.length ? termsRaw : ["travel skyline city"]).map((t) => t.trim()),
      (x) => x.toLowerCase()
    ).slice(0, 14);

    const count = Math.min(60, Math.max(8, Number(searchParams.get("count")) || 24));
    const orientationParam = String(searchParams.get("side") || searchParams.get("orientation") || "portrait")
      .toLowerCase();
    const orientation: Orientation =
      orientationParam === "landscape" ? "landscape" : orientationParam === "any" ? "any" : "portrait";

    // Split count across terms and fetch in parallel
    const perTerm = Math.max(2, Math.ceil(count / Math.max(1, terms.length)));

    const commonsBatches = terms.map((t) => searchCommons(t, perTerm));
    const commonsSettled = await Promise.allSettled(commonsBatches);
    let photos = commonsSettled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));

    if (photos.length < Math.max(6, count / 2)) {
      // Fallback to Openverse for any missing slots
      const ovBatches = terms.map((t) => searchOpenverse(t, perTerm, orientation));
      const ovSettled = await Promise.allSettled(ovBatches);
      const ov = ovSettled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
      photos = photos.concat(ov);
    }

    const images = uniqBy(photos, (p) => p.src).slice(0, count);

    if (!images.length) {
      return ok([
        {
          id: "fallback",
          src: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Skyline_placeholder.png/768px-Skyline_placeholder.png",
          width: 768,
          height: 512,
          alt: "Travel",
        },
      ]);
    }

    return ok(images);
  } catch (err: any) {
    return ok({ error: err?.message || "Unexpected error" }, 500);
  }
}

export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control":
        "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
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
      "Cache-Control":
        "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
