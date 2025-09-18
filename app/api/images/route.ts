// app/api/images/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// --- tiny helpers ---
const short = (s: string, n = 800) =>
  (s || "").slice(0, n) + ((s || "").length > n ? " …[truncated]" : "");

type Img = { url: string; title?: string; source?: string; license?: string };

// Verify the URL is an image (cheap HEAD). If HEAD is blocked, we still accept.
async function verifyImage(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

/**
 * Search Commons with a very **simple** term (ex: "Miami South Beach").
 * We intentionally **do not** pass long sentences—Commons works best with short phrases.
 */
async function commonsSearchOnce(term: string, need: number): Promise<Img[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", `${term} filetype:bitmap`);
  u.searchParams.set("gsrlimit", String(Math.min(50, Math.max(need * 4, 20))));
  u.searchParams.set("iiprop", "url|mime|extmetadata");
  u.searchParams.set("iiurlwidth", "1600");
  u.searchParams.set("origin", "*");

  const res = await fetch(u.toString(), {
    cache: "no-store",
    headers: {
      // Being explicit here often helps Commons
      "User-Agent": "WanderBot/1.0 (image-loader) (+no PII)",
    },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const pages: any[] = Object.values(data?.query?.pages ?? {});
  const out: Img[] = [];

  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    const mime = (ii?.mime ?? "").toLowerCase();
    const url = ii?.thumburl || ii?.url;
    if (!url || !mime.startsWith("image/")) continue;

    let ok = true;
    try {
      ok = await verifyImage(url);
    } catch {}
    if (!ok) continue;

    out.push({
      url,
      title: p?.title,
      source:
        "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p?.title || ""),
      license: ii?.extmetadata?.LicenseShortName?.value,
    });
    if (out.length >= need) break;
  }
  return out;
}

// Normalize the body. We accept either:
// 1) { q: "Miami South Beach", count?: 12 }
// 2) { city: "Miami", terms: ["South Beach","Wynwood","Art Deco"], count?: 24 }
function parseBody(body: any): { terms: string[]; count: number; debug: string } {
  const count = Math.max(1, Math.min(Number(body?.count ?? 12), 36));

  const single = (body?.q ?? "").toString().trim();
  if (single) {
    return { terms: [single], count, debug: `single="${single}"` };
  }

  const city = (body?.city ?? "").toString().trim();
  const list = Array.isArray(body?.terms)
    ? (body.terms as unknown[])
        .map((t) => (typeof t === "string" ? t : ""))
        .filter(Boolean)
    : [];

  // Build **simple** "<city> <term>" phrases (or just the term if city missing).
  const terms = (list.length ? list : ["skyline", "downtown", "landmark"]).map((t) =>
    city ? `${city} ${t}` : t
  );

  return { terms, count, debug: `city="${city}" terms=${JSON.stringify(list)}` };
}

// ---- POST handler ----
export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const body = await req.json().catch(() => ({}));
    const { terms, count, debug } = parseBody(body);
    console.log(`[images ${reqId}] need=${count}  terms=`, short(terms.join(" | ")));
    console.log(`[images ${reqId}] debug=`, debug);

    const seen = new Set<string>();
    const results: Img[] = [];

    // Query each simple term **separately**, dedupe, stop when we have enough.
    for (const term of terms) {
      if (results.length >= count) break;
      const need = count - results.length;
      const chunk = await commonsSearchOnce(term, need);
      for (const im of chunk) {
        if (!im?.url || seen.has(im.url)) continue;
        seen.add(im.url);
        results.push(im);
        if (results.length >= count) break;
      }
    }

    console.log(`[images ${reqId}] returned=${results.length}/${count}`);
    return NextResponse.json({ images: results });
  } catch (e: any) {
    console.error(`[images fatal]`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
