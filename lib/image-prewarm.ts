// lib/image-prewarm.ts
"use client";

/**
 * Small client-side prewarmer:
 * - Calls /api/images with { terms, count }
 * - Preloads returned URLs with <img> so detail pages feel instant
 * - Caches by (terms,count) to avoid duplicate network work
 */

type Img = { url: string; title?: string; source?: string; license?: string };

type CacheEntry = {
  inflight?: Promise<string[]>;
  urls: string[];
  ts: number;
};

const store = new Map<string, CacheEntry>();

function keyFor(terms: string[], count: number) {
  const t = [...new Set(terms.map((s) => s.trim().toLowerCase()))].sort();
  return JSON.stringify({ t, c: count });
}

async function fetchImageURLs(terms: string[], count: number): Promise<string[]> {
  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ terms, count: Math.max(8, Math.min(24, count)) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`images api ${res.status}`);
  const json = await res.json();
  // Support your route’s formats: { images: [{url:...}, ...] } OR { urls: [...] }
  if (Array.isArray(json?.images)) {
    return (json.images as Img[]).map((x) => x?.url).filter((u) => typeof u === "string");
  }
  if (Array.isArray(json?.urls)) {
    return (json.urls as string[]).filter((u) => typeof u === "string");
  }
  return [];
}

function preload(urls: string[], take: number) {
  if (typeof window === "undefined") return;
  urls.slice(0, take).forEach((u) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = u;
  });
}

/** Public: prewarm and memoize by key. Safe to call multiple times. */
export async function prewarmImages(terms: string[], count = 16): Promise<string[]> {
  if (!terms?.length) return [];
  const k = keyFor(terms, count);
  const cached = store.get(k);
  if (cached?.urls?.length) return cached.urls;
  if (cached?.inflight) return cached.inflight;

  const inflight = (async () => {
    const urls = await fetchImageURLs(terms, count);
    preload(urls, count);
    store.set(k, { urls, ts: Date.now() });
    return urls;
  })();

  store.set(k, { urls: [], inflight, ts: Date.now() });
  return inflight;
}

/** Build concise "<city> <keyword>" terms from a destination object. */
export function buildSimpleTermsFromDest(dest: any, limit = 12): string[] {
  const name = String(dest?.name || "").trim();
  const analysis = dest?.analysis ?? {};
  const model: string[] = Array.isArray(analysis.image_queries)
    ? analysis.image_queries.filter((s: unknown): s is string => typeof s === "string" && !!s.trim())
    : [];

  if (model.length) {
    const cleaned = model.map((t) => {
      const one = t.replace(/\s+/g, " ").trim();
      if (name && one.toLowerCase().startsWith(name.toLowerCase() + " ")) return one;
      return name ? `${name} ${one}` : one;
    });
    return Array.from(new Set(cleaned)).slice(0, limit);
  }

  const basics = [
    "skyline",
    "downtown",
    "beach",
    "park",
    "museum",
    "nightlife",
    "market",
    "street",
    "festival",
    "landmarks",
  ].map((k) => (name ? `${name} ${k}` : k));

  return Array.from(new Set(basics)).slice(0, limit);
}
