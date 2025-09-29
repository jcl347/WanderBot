// app/api/images/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

type Img = { url: string; title?: string; source?: string; license?: string };

// Accept EITHER terms[] OR q string; count optional
const BodySchema = z.object({
  terms: z.array(z.string()).optional(),
  q: z.string().optional(),
  count: z.number().int().min(1).max(48).optional(),
}).refine(
  (b) =>
    (Array.isArray(b.terms) && b.terms.length > 0) ||
    (typeof b.q === "string" && b.q.trim() !== ""),
  { message: "Provide 'terms' (array) or 'q' (string)" }
);

// ---- Utilities -------------------------------------------------------------

// Best-effort HEAD check: never block success on HEAD flakiness
async function verifyImage(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    return res.ok && ct.startsWith("image/");
  } catch {
    return true; // do NOT tank results on HEAD failures
  }
}

// Normalize terms: keep short, dedupe, cap length
function normalizeTerms(inputTerms?: string[], q?: string, want = 12): string[] {
  let parts: string[] = [];
  if (Array.isArray(inputTerms) && inputTerms.length) {
    parts = inputTerms;
  } else if (q && q.trim()) {
    // support comma- or space-separated; keep as a few compact chunks
    const raw = q.includes(",") ? q.split(",") : [q];
    parts = raw;
  }

  const cleaned = parts
    .map((t) => (t || "").trim())
    .filter(Boolean)
    // keep each term short so Commons search behaves well
    .map((s) => s.split(/\s+/).slice(0, 3).join(" "));

  return Array.from(new Set(cleaned)).slice(0, want);
}

function commonsSearchUrl(term: string, pageSize: number) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("origin", "*");

  // Critical bits:
  // - generator=search over FILE namespace (6)
  // - filetype:bitmap to avoid SVGs/diagrams
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", `${term} filetype:bitmap`);
  u.searchParams.set("gsrnamespace", "6");
  u.searchParams.set("gsrlimit", String(Math.min(50, Math.max(pageSize, 6))));

  // Ask for imageinfo with mime + a large thumb
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("iiprop", "url|mime|extmetadata");
  u.searchParams.set("iiurlwidth", "1600");
  return u.toString();
}

type Candidate = { url: string; mime?: string; title: string; license?: string };

async function fetchCommons(term: string, pageSize: number): Promise<Candidate[]> {
  // Light retry for transient 5xx
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(commonsSearchUrl(term, pageSize), { cache: "no-store" });
    if (!res.ok) {
      if (res.status >= 500 && attempt === 0) continue;
      return [];
    }
    const data = await res.json();
    const pages = Object.values<any>(data?.query?.pages ?? {});
    const out: Candidate[] = [];
    for (const p of pages) {
      const ii = p?.imageinfo?.[0];
      if (!ii) continue;
      const mime = String(ii?.mime || "").toLowerCase();
      // Prefer true bitmaps; skip SVGs & non-images early
      if (!mime.startsWith("image/")) continue;

      const url: string | undefined = ii?.thumburl || ii?.url;
      if (!url) continue;

      out.push({
        url,
        mime,
        title: p?.title || "",
        license: ii?.extmetadata?.LicenseShortName?.value,
      });
    }
    return out;
  }
  return [];
}

// Merge, dedupe by title stem, cap
function mergeDedupeLimit(cands: Candidate[], limit: number): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of cands) {
    const stem = c.title.toLowerCase().replace(/\.(jpe?g|png|webp|gif)$/i, "");
    if (seen.has(stem)) continue;
    seen.add(stem);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

// Small parallel pool
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>
): Promise<R[]> {
  const ret: R[] = [];
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(workers);
  return ret;
}

// ---- Handler ---------------------------------------------------------------

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      console.log(`[images ${reqId}] bad body`, parsed.error.issues);
      return NextResponse.json({ images: [], error: parsed.error.issues }, { status: 200 });
    }

    const { terms, q, count: countRaw } = parsed.data;
    const count = countRaw ?? 12;

    // Gather a bit more than needed; trim after dedupe/verify
    const termList = normalizeTerms(terms, q, Math.min(24, Math.max(8, count * 2)));
    if (termList.length === 0) return NextResponse.json({ images: [] });

    console.log(`[images ${reqId}] terms=`, termList);

    const perTerm = Math.max(6, Math.ceil((count * 2) / Math.max(1, termList.length)));

    // Fetch results in parallel with a small pool
    const lists = await mapPool(termList, 4, (t) => fetchCommons(t, perTerm));
    const flat = lists.flat();

    // Dedupe by title stem and cap to a working set before HEAD checks
    const prelim = mergeDedupeLimit(flat, Math.min(64, count * 3));

    // Best-effort HEAD verify without blocking success
    const verified: Img[] = [];
    for (const c of prelim) {
      if (verified.length >= count) break;
      const ok = await verifyImage(c.url); // non-blocking (returns true on network error)
      if (!ok) continue;
      verified.push({
        url: c.url,
        title: c.title,
        source: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(c.title || ""),
        license: c.license,
      });
    }

    console.log(`[images ${reqId}] returned=${verified.length}/${count}`);
    return NextResponse.json({ images: verified });
  } catch (e: any) {
    console.error(`[images fatal ${reqId}]`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 200 });
  }
}
