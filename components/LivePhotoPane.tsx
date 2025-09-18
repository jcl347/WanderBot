"use client";

import React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source?: string; license?: string };

type Props = {
  city: string;
  terms: string[];        // short terms from LLM (no city names)
  total?: number;         // total images to show after merging
  perTerm?: number;       // how many to fetch per term
  label?: string;
  className?: string;
};

async function fetchImages(q: string, count: number): Promise<Img[]> {
  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q, count }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({ images: [] as Img[] }));
  return Array.isArray(data?.images) ? (data.images as Img[]) : [];
}

export default function LivePhotoPane({
  city,
  terms,
  total = 14,
  perTerm = 8,
  label,
  className = "",
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function go() {
      setLoading(true);
      try {
        const simpleTerms = (terms || [])
          .map((t) => String(t || "").trim())
          .filter(Boolean);

        const queries = simpleTerms.map((t) => `${city} ${t}`);
        const batches = await Promise.all(
          queries.map((q) => fetchImages(q, perTerm))
        );

        const seen = new Set<string>();
        const merged: Img[] = [];
        for (const arr of batches) {
          for (const img of arr) {
            if (!img?.url || seen.has(img.url)) continue;
            seen.add(img.url);
            merged.push(img);
            if (merged.length >= total) break;
          }
          if (merged.length >= total) break;
        }

        if (!cancelled) setImages(merged);
      } catch {
        if (!cancelled) setImages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    go();
    return () => {
      cancelled = true;
    };
  }, [city, JSON.stringify(terms), total, perTerm]);

  return (
    <div
      className={`relative rounded-2xl border bg-white/70 p-3 md:p-4 backdrop-blur-sm ${className}`}
      aria-label={label || `${city} photos`}
    >
      {loading && images.length === 0 ? (
        <div className="text-xs text-zinc-500">Loading images for {city}…</div>
      ) : null}

      {images.length === 0 && !loading ? (
        <div className="text-xs text-zinc-500">No images found.</div>
      ) : null}

      <div
        className="
          grid gap-2 md:gap-3
          grid-cols-3
          sm:grid-cols-4 md:grid-cols-5
        "
      >
        {images.map((img, i) => {
          const big = i % 7 === 0 || i % 11 === 0;
          const span = big ? "col-span-2 row-span-2" : "";
          const priority = i < 6;

          return (
            <div key={img.url} className={`relative aspect-[4/5] overflow-hidden rounded-xl ${span}`}>
              <Image
                src={img.url}
                alt={img.title || `${city} photo`}
                fill
                sizes="(max-width: 768px) 33vw, 20vw"
                className="object-cover"
                priority={priority}
                loading={priority ? "eager" : "lazy"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
