// app/api/images/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Img = {
  url: string;
  title?: string;
  source?: string;
  license?: string;
  width?: number;
  height?: number;
};

async function verifyImage(url: string) {
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
 * Robust Wikimedia Commons search that targets file namespace (6),
 * returns imageinfo with a decent thumb, and works with simple phrases
 * like "Miami South Beach" or "Miami Wynwood Walls".
 */
async function commonsSearchSimple(q: string, count: number): Promise<Img[]> {
  const reqId = Math.random().toString(36).slice(2, 8);
  const take = Math.min(50, Math.max(count * 4, 20));

  // We try two variants:
  //   1) raw phrase
  //   2) quoted phrase (helps with multi-word e.g., "South Beach")
  const variants = [q, `"${q}"`];

  console.log(`[images ${reqId}] commons start q="${q}" variants=${variants.length}`);

  const results: Img[] = [];
  const seen = new Set<string>();

  for (const v of variants) {
    if (results.length >= count) break;

    const u = new URL("https://commons.wikimedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("format", "json");
    u.searchParams.set("origin", "*");
    // generator=search in File (6) namespace finds actual images
    u.searchParams.set("generator", "search");
    u.searchParams.set("gsrsearch", v);
    u.searchParams.set("gsrnamespace", "6"); // File namespace
    u.searchParams.set("gsrlimit", String(take));
    // fetch image info + a good sized thumb
    u.searchParams.set("prop", "imageinfo");
    u.searchParams.set("iiprop", "url|mime|extmetadata|size");
    u.searchParams.set("iiurlwidth", "1600");
    // be explicit
    u.searchParams.set("uselang", "en");

    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.log(`[images ${reqId}] commons status=${res.status} for variant="${v}"`);
      continue;
    }

    const data = await res.json();
    const pages: any[] = Object.values(data?.query?.pages ?? {});
    console.log(
      `[images ${reqId}] variant="${v}" pages=${pages.length} (pre-filter)`
    );

    for (const p of pages) {
      if (results.length >= count) break;
      const ii = p?.imageinfo?.[0];
      const url: string | undefined = ii?.thumburl || ii?.url;
      const mime = (ii?.mime ?? "").toLowerCase();
      if (!url || !mime.startsWith("image/")) continue;
      if (seen.has(url)) continue;

      // quick HEAD to avoid broken images
      if (!(await verifyImage(url))) continue;

      seen.add(url);
      results.push({
        url,
        title: p?.title,
        width: ii?.thumbwidth ?? ii?.width,
        height: ii?.thumbheight ?? ii?.height,
        source:
          "https://commons.wikimedia.org/wiki/" +
          encodeURIComponent(p?.title || ""),
        license: ii?.extmetadata?.LicenseShortName?.value,
      });
    }
  }

  console.log(
    `[images ${reqId}] commons verified=${results.length}/${count} (returning)`
  );
  return results.slice(0, count);
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({} as any));
    const q = String(body?.q ?? "").trim();
    const count = Math.max(1, Math.min(Number(body?.count ?? 12), 24));

    if (!q) {
      console.log(`[images ${reqId}] missing q`);
      return NextResponse.json({ images: [] });
    }

    // Keep the phrase intact (e.g., "Miami South Beach"), do not truncate.
    const images = await commonsSearchSimple(q, count);
    return NextResponse.json({ images });
  } catch (e: any) {
    console.error(`[images fatal]`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
