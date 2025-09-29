// app/api/images/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

type Img = { url: string; title?: string; source?: string; license?: string };

// ---- Zod body: accept EITHER terms[] OR q string; count optional
const BodySchema = z
  .object({
    terms: z.array(z.string()).optional(),
    q: z.string().optional(),
    count: z.number().int().min(1).max(48).optional(),
  })
  .refine(
    (b) => (Array.isArray(b.terms) && b.terms.length > 0) || (typeof b.q === "string" && b.q.trim() !== ""),
    { message: "Provide 'terms' (array) or 'q' (string)" }
  );

// Simple HEAD check to make sure the URL is actually an image
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

// Build a small list of plain search terms
function normalizeTerms(inputTerms?: string[], q?: string, want = 12): string[] {
  // If explicit terms were passed, use them as-is
  if (Array.isArray(inputTerms) && inputTerms.length) {
    return Array.from(
      new Set(
        inputTerms
          .map((t) => String(t || "").trim())
          .filter(Boolean)
      )
    ).slice(0, want);
  }

  // Otherwise split q by commas and trim
  const parts = String(q || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // If q didn't have commas, just use q as a single term
  if (parts.length === 0 && q && q.trim()) parts.push(q.trim());

  // De-duplicate and cap
  return Array.from(new Set(parts)).slice(0, want);
}

// Very light Wikimedia Commons search for each term (simple queries)
async function commonsSearchSingleTerm(term: string, pageSize: number): Promise<Img[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("generator", "search");
  // keep queries simple: just the term (no extra operators)
  u.searchParams.set("gsrsearch", term);
  u.searchParams.set("gsrlimit", String(Math.min(50, Math.max(pageSize, 6))));
  u.searchParams.set("iiprop", "url|mime|extmetadata");
  u.searchParams.set("iiurlwidth", "1600");
  u.searchParams.set("origin", "*");

  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  const pages: any[] = Object.values(data?.query?.pages ?? {});
  const out: Img[] = [];

  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    const url: string | undefined = ii?.thumburl || ii?.url;
    const mime = (ii?.mime ?? "").toLowerCase();
    if (!url || !mime.startsWith("image/")) continue;

    // quick verification to avoid broken images
    const ok = await verifyImage(url);
    if (!ok) continue;

    out.push({
      url,
      title: p?.title,
      source: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(p?.title || ""),
      license: ii?.extmetadata?.LicenseShortName?.value,
    });
  }

  return out;
}

// Merge, dedupe by URL, and cap
function mergeDedupeLimit(lists: Img[][], limit: number): Img[] {
  const seen = new Set<string>();
  const out: Img[] = [];
  for (const arr of lists) {
    for (const im of arr) {
      if (!im?.url || seen.has(im.url)) continue;
      seen.add(im.url);
      out.push(im);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      console.log(`[images ${reqId}] bad body`, parsed.error.issues);
      // Return empty list but do NOT 400; the client expects JSON consistently
      return NextResponse.json({ images: [], error: parsed.error.issues }, { status: 200 });
    }

    const { terms, q, count: countRaw } = parsed.data;
    const count = countRaw ?? 12;
    const termList = normalizeTerms(terms, q, Math.min(24, Math.max(8, count * 2)));

    console.log(`[images ${reqId}] terms=`, termList);

    if (termList.length === 0) {
      return NextResponse.json({ images: [] });
    }

    // Query Commons for each term, small page size to keep latency low
    const perTerm = Math.max(6, Math.ceil((count * 2) / Math.max(1, termList.length)));
    const results: Img[][] = [];

    // Run sequentially to be gentle with the API (can parallelize if needed)
    for (const t of termList) {
      const imgs = await commonsSearchSingleTerm(t, perTerm);
      results.push(imgs);
      // quick short-circuit if we've already got enough
      const merged = mergeDedupeLimit(results, count);
      if (merged.length >= count) {
        console.log(`[images ${reqId}] early stop (enough images)`);
        return NextResponse.json({ images: merged });
      }
    }

    const merged = mergeDedupeLimit(results, count);
    console.log(`[images ${reqId}] returned=${merged.length}/${count}`);
    return NextResponse.json({ images: merged });
  } catch (e: any) {
    console.error(`[images fatal ${reqId}]`, e?.message || e);
    return NextResponse.json({ images: [] }, { status: 200 });
  }
}
