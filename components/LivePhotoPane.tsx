// components/LivePhotoPane.tsx
"use client";

import React from "react";

type Img = {
  url: string;
  title?: string;
  source?: string;
  license?: string;
  width?: number;
  height?: number;
};

type Props = {
  query: string;       // simple phrase e.g., "Miami South Beach"
  count?: number;      // how many to show
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
  const json = await res.json().catch(() => ({ images: [] }));
  return Array.isArray(json?.images) ? (json.images as Img[]) : [];
}

function preload(urls: string[]) {
  // Warm the cache so large tiles paint immediately when visible
  for (const u of urls) {
    const img = new Image();
    img.src = u;
  }
}

export default function LivePhotoPane({ query, count = 10, className = "" }: Props) {
  const [images, setImages] = React.useState<Img[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      const imgs = await fetchImages(query, count);
      if (cancelled) return;
      setImages(imgs);
      // Preload in the background; when user clicks the card we’re warm.
      preload(imgs.slice(0, 16).map((x) => x.url));
      setLoaded(true);
      console.log(
        `[images pane] query="${query}" total_returned=${imgs.length}`
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [query, count]);

  if (!loaded && images.length === 0) {
    return (
      <div className={`rounded-xl border bg-white/60 p-3 text-xs text-gray-500 ${className}`}>
        Loading images for: <span className="font-medium">{query}</span>…
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={`rounded-xl border bg-white/60 p-3 text-xs text-gray-500 ${className}`}>
        No images found for: <span className="font-medium">{query}</span>
      </div>
    );
  }

  // A responsive collage:
  // - 2 columns on small screens, 3 on md, 4 on lg
  // - varied row spans for a natural collage feel
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ${className}`}
    >
      {images.map((img, i) => {
        // vary sizes by index for a pleasant collage
        const tall = i % 7 === 0 || i % 7 === 3;
        const wide = i % 5 === 2;

        const spanCols = wide ? "col-span-2" : "col-span-1";
        // only allow a "tall" row span when there is room (md+)
        const spanRows =
          tall ? "row-span-2 md:row-span-2" : "row-span-1 md:row-span-1";

        return (
          <figure
            key={`${img.url}-${i}`}
            className={`relative overflow-hidden rounded-lg bg-gray-100 ${spanCols} ${spanRows}`}
          >
            <img
              src={img.url}
              alt={img.title || query}
              className="h-full w-full object-cover"
              // eager for first tile to improve LCP; rest lazy
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </figure>
        );
      })}
    </div>
  );
}
