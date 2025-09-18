"use client";

import React from "react";
import { getCachedImages, setCachedImages, prewarmImages } from "@/lib/imageCache";

type Img = { url: string; title?: string; source?: string; license?: string };
type Props = { query: string; count?: number; className?: string };

export default function LivePhotoPane({ query, count = 12, className = "" }: Props) {
  const [images, setImages] = React.useState<Img[]>(
    () => getCachedImages(`${query}::${count}`) || []
  );

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // Serve instantly if already cached; still prewarm to be safe.
      const key = `${query}::${count}`;
      const cached = getCachedImages(key);
      if (cached && !cancelled) setImages(cached);

      const fresh = await prewarmImages(query, count);
      if (!cancelled) {
        setImages(fresh);
        setCachedImages(key, fresh);
      }
    })();

    return () => { cancelled = true; };
  }, [query, count]);

  if (!images.length) {
    return (
      <div className={`rounded-xl border bg-white/60 p-3 text-xs text-gray-500 ${className}`}>
        Loading images for <span className="font-medium">{query}</span>…
      </div>
    );
  }

  return (
    <div className={`grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${className}`}>
      {images.map((img, i) => {
        // larger, varied tiles for a true collage feel
        const tall = i % 6 === 0 || i % 6 === 3;
        const wide = i % 5 === 2;

        const col = wide ? "col-span-2" : "col-span-1";
        const row = tall ? "row-span-2" : "row-span-1";

        return (
          <figure
            key={`${img.url}-${i}`}
            className={`relative overflow-hidden rounded-2xl bg-gray-100 ${col} ${row}`}
          >
            <img
              src={img.url}
              alt={img.title || query}
              className="h-full w-full object-cover"
              loading={i < 4 ? "eager" : "lazy"}
              decoding="async"
            />
          </figure>
        );
      })}
    </div>
  );
}
