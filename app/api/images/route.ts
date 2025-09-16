// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// shallow URL check (very lightweight)
function isHttpUrl(s: string | undefined): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Try DuckDuckGo Images JSON (unofficial but stable enough server-side)
async function fetchFromDDG(query: string, count: number) {
  const url =
    "https://duckduckgo.com/i.js?o=json&l=us-en&vqd=3-12345&q=" +
    encodeURIComponent(query);
  const resp = await fetch(url, {
    // Some CDNs require UA + referer to return image payloads
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      referer: "https://duckduckgo.com/",
      accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!resp.ok) return [];

  const json = (await resp.json()) as any;
  const results: Array<{ url: string; title?: string; source?: string }> =
    Array.isArray(json?.results)
      ? json.results
          .map((r: any) => ({
            url: r?.image || r?.thumbnail,
            title: r?.title,
            source: r?.url || r?.source,
          }))
          .filter((r: any) => isHttpUrl(r.url))
      : [];

  return results.slice(0, count);
}

// Wikimedia Commons fallback for reliability
async function fetchFromWikimedia(query: string, count: number) {
  const api =
    "https://commons.wikimedia.org/w/api.php" +
    "?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&generator=search" +
    "&gsrnamespace=6&gsrlimit=" +
    count +
    "&gsrsearch=" +
    encodeURIComponent(query + " filetype:bitmap");
  const resp = await fetch(api, { cache: "no-store" });
  if (!resp.ok) return [];

  const json = (await resp.json()) as any;
  const pages = json?.query?.pages || {};
  const urls: Array<{ url: string; title?: string; source?: string }> = Object.values(
    pages
  )
    .map((p: any) => p?.imageinfo?.[0]?.url)
    .filter((u: string) => isHttpUrl(u))
    .map((u: string) => ({ url: u, title: "", source: "Wikimedia Commons" }));
  return urls.slice(0, count);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const count = Math.min(Math.max(Number(searchParams.get("count") || 8), 1), 16);

    if (!q) {
      return NextResponse.json({ images: [] }, { status: 200 });
    }

    let images = await fetchFromDDG(q, count);
    if (images.length === 0) {
      // Fallback to Wikimedia if DDG returns nothing
      images = await fetchFromWikimedia(q, count);
    }

    // Return only https; helps with mixed content/CDN issues
    const clean = images
      .filter((i) => i.url?.startsWith("http"))
      .map((i) => ({ url: i.url, title: i.title || "", source: i.source || "" }));

    return NextResponse.json({ images: clean }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/images] error:", e?.message || e);
    return NextResponse.json({ images: [] }, { status: 200 });
  }
}
