// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // needed for ranged fetch & timeouts
export const dynamic = "force-dynamic";

type Img = { url: string; title?: string; source?: string };

function log(scope: string, msg: string, extra: Record<string, any> = {}) {
  // Pretty, compact logs that are easy to filter in Vercel
  console.info(`[images:${scope}] ${msg} ${JSON.stringify(extra)}`);
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function stem(u: string) {
  try {
    const x = new URL(u);
    const p = x.pathname.split("/").pop() || "";
    // hostname + filename (no extension) = good enough dedupe key
    return `${x.hostname}/${p.replace(/\.(jpg|jpeg|png|webp|gif|bmp|tiff).*$/i, "")}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

// --- Network helpers --------------------------------------------------------

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function verifyImage(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      // tiny range so we don't download full images during verification
      headers: { range: "bytes=0-2047" },
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

async function verifyMany(candidates: Img[], want: number): Promise<Img[]> {
  const out: Img[] = [];
  const dedup = new Set<string>();
  const queue = candidates.filter((c) => {
    const key = stem(c.url);
    if (dedup.has(key)) return false;
    dedup.add(key);
    return true;
  });

  // Gentle concurrency to be kind to remote CDNs
  const CONCURRENCY = 4;
  let idx = 0;

  async function worker() {
    while (out.length < want && idx < queue.length) {
      const cand = queue[idx++];
      // eslint-disable-next-line no-await-in-loop
      const ok = await verifyImage(cand.url);
      if (ok) out.push(cand);
    }
  }

  const jobs = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(jobs);
  return out.slice(0, want);
}

// --- DuckDuckGo Images ------------------------------------------------------

async function getDDGVqd(query: string): Promise<string | null> {
  try {
    // DuckDuckGo returns a token ("vqd") in the HTML for the query
    const html = await fetchWithTimeout(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      { headers: { "user-agent": "Mozilla/5.0" } },
      8000
    ).then((r) => r.text());

    const m = html.match(/vqd='([\d-]+)'/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

async function ddgImages(query: string, goal: number): Promise<Img[]> {
  const token = await getDDGVqd(query);
  if (!token) {
    log("ddg", "missing token", { query });
    return [];
  }

  let next = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${token}&f=,,,&p=1`;
  const out: Img[] = [];

  for (let page = 0; page < 3 && out.length < goal * 3; page++) {
    try {
      const res = await fetchWithTimeout(next, { headers: { "user-agent": "Mozilla/5.0" } }, 8000);
      if (!res.ok) break;
      const json = await res.json();
      const results = Array.isArray(json.results) ? json.results : [];
      for (const r of results) {
        const url = r?.image || r?.thumbnail || r?.url;
        if (typeof url === "string") {
          out.push({
            url,
            title: r?.title || r?.source || query,
            source: r?.source || "duckduckgo",
          });
        }
      }
      if (typeof json.next === "string") {
        next = `https://duckduckgo.com${json.next}`;
      } else {
        break;
      }
    } catch (e) {
      log("ddg", "page fetch error", { page, message: (e as Error).message });
      break;
    }
  }

  log("ddg", "raw collected", { count: out.length, query });
  return out;
}

// --- Wikimedia Commons fallback ---------------------------------------------

async function commonsImages(query: string, want: number): Promise<Img[]> {
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php" +
      `?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrlimit=${Math.max(want * 2, 20)}&prop=imageinfo&iiprop=url&iiurlwidth=1600&format=json&origin=*`;

    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return [];
    const json = await res.json();

    const pages = json?.query?.pages || {};
    const out: Img[] = [];
    for (const k of Object.keys(pages)) {
      const p = pages[k];
      const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
      const src = info?.thumburl || info?.url;
      if (typeof src === "string") {
        out.push({
          url: src,
          title: p?.title || query,
          source: "wikimedia",
        });
      }
    }
    log("commons", "raw collected", { count: out.length, query });
    return out;
  } catch (e) {
    log("commons", "error", { message: (e as Error).message });
    return [];
  }
}

// --- API route --------------------------------------------------------------

export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const count = Math.max(2, Math.min(40, Number(searchParams.get("count") || "16")));

    if (!q) {
      return NextResponse.json({ images: [] }, { status: 200 });
    }

    log("request", "start", { q, count });

    // 1) Fetch from DDG (primary)
    const ddg = await ddgImages(q, count);

    // 2) Fallback to Wikimedia if DDG is light
    let combined = ddg;
    if (combined.length < count) {
      const fallback = await commonsImages(q, count);
      combined = combined.concat(fallback);
    }

    // Overshoot to allow for verification failures
    shuffle(combined);
    const overshoot = Math.max(count * 3, count + 20);
    const candidates = combined.slice(0, overshoot);

    // 3) Server-side verification (MIME/image/* via small range)
    const verified = await verifyMany(candidates, count);

    const elapsed = Date.now() - started;
    log("response", "done", {
      q,
      requested: count,
      ddg_raw: ddg.length,
      combined_raw: combined.length,
      verified: verified.length,
      ms: elapsed,
    });

    // Minimal CORS so client can call this route freely
    const res = NextResponse.json({ images: verified }, { status: 200 });
    res.headers.set("cache-control", "no-store");
    res.headers.set("access-control-allow-origin", "*");
    return res;
  } catch (err: any) {
    const elapsed = Date.now() - started;
    log("fatal", "error", { message: err?.message || String(err), ms: elapsed });
    return NextResponse.json({ images: [] }, { status: 200 });
  }
}
