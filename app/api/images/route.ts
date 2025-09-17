// app/api/images/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

type Img = { url: string; title?: string; source?: string; license?: string };

async function openverseSearch(q: string, count: number): Promise<Img[]> {
  const reqId = Math.random().toString(36).slice(2, 8);
  const u = new URL("https://api.openverse.engineering/v1/images/");
  u.searchParams.set("q", q);
  u.searchParams.set("license", "cc0,cc-by,cc-by-sa,cc-by-nd,cc-by-nc,cc-by-nc-sa,cc-by-nc-nd,publicdomain");
  u.searchParams.set("page_size", String(Math.min(50, Math.max(count * 4, 20))));
  console.log(`[images ${reqId}] openverse q=`, q);

  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const results: Img[] = [];

  for (const r of data?.results || []) {
    const url = r?.url || r?.thumbnail;
    if (!url) continue;
    const ok = await verifyImage(url);
    if (!ok) continue;
    results.push({
      url,
      title: r?.title,
      source: r?.foreign_landing_url,
      license: r?.license || r?.license_version,
    });
    if (results.length >= count) break;
  }
  console.log(`[images ${reqId}] openverse verified=${results.length}/${count}`);
  return results;
}

// Very light Wikimedia fallback if Openverse comes up dry
async function commonsSearch(q: string, count: number): Promise<Img[]> {
  const reqId = Math.random().toString(36).slice(2, 8);
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", `${q} filetype:bitmap`);
  u.searchParams.set("gsrlimit", String(Math.min(50, Math.max(count * 4, 20))));
  u.searchParams.set("iiprop", "url|mime|extmetadata");
  u.searchParams.set("iiurlwidth", "1600");
  u.searchParams.set("origin", "*");

  console.log(`[images ${reqId}] commons q=`, q);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const pages: any[] = Object.values(data?.query?.pages ?? {});
  const out: Img[] = [];
  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    const url = ii?.thumburl || ii?.url;
    const mime = (ii?.mime ?? "").toLowerCase();
    if (!url || !mime.startsWith("image/")) continue;
    if (!(await verifyImage(url))) continue;

    out.push({
      url,
      title: p?.title,
      source: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p?.title || ""),
      license: ii?.extmetadata?.LicenseShortName?.value,
    });
    if (out.length >= count) break;
  }
  console.log(`[images ${reqId}] commons verified=${out.length}/${count}`);
  return out;
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({} as any));
    const q = String(body?.q ?? "").trim();
    const count = Number(body?.count ?? 12);
    if (!q) {
      console.log(`[images ${reqId}] missing q`);
      return NextResponse.json({ images: [] });
    }
    console.log(`[images ${reqId}] request q="${q}" count=${count}`);

    let images = await openverseSearch(q, Math.max(1, Math.min(count, 24)));
    if (images.length < Math.min(count, 12)) {
      const need = Math.min(count, 24) - images.length;
      const extra = await commonsSearch(q, need);
      images = images.concat(extra);
    }
    console.log(`[images ${reqId}] total_returned=${images.length}`);

    return NextResponse.json({ images });
  } catch (e: any) {
    console.error(`[images fatal]`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
