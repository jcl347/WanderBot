// lib/imageCache.ts
type Img = { url: string; title?: string; source?: string; license?: string };

const mem = new Map<string, Img[]>();

export function getCachedImages(key: string) {
  return mem.get(key);
}

export function setCachedImages(key: string, images: Img[]) {
  mem.set(key, images);
}

export async function prewarmImages(query: string, count = 12) {
  const key = `${query}::${count}`;
  if (mem.has(key)) return mem.get(key)!;

  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: query, count }),
    cache: "no-store",
  }).catch(() => null);

  const json = await res?.json().catch(() => null);
  const images: Img[] = Array.isArray(json?.images) ? json!.images : [];

  // warm browser cache too
  for (const img of images.slice(0, 24)) {
    const el = new Image();
    el.decoding = "async";
    el.loading = "eager";
    el.src = img.url;
  }

  mem.set(key, images);
  return images;
}
