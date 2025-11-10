// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source: "wikimedia" };

type Props = {
  terms: string[];
  count?: number;            // target number of tiles
  className?: string;
  side?: "left" | "right";
};

async function fetchImages(terms: string[], count: number, lenient = false): Promise<Img[]> {
  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      terms,
      count,
      source: "wikimedia",
      lenient,
    }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json?.images) ? json.images : []).filter((x: any) => x?.url) as Img[];
}

function pad(images: Img[], n: number): Img[] {
  if (images.length >= n) return images.slice(0, n);
  const out: Img[] = [];
  for (let i = 0; i < n; i++) out.push(images[i % Math.max(1, images.length)]);
  return out;
}

export default function LivePhotoPane({ terms, count = 36, className, side = "left" }: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      const primary = terms.slice(0, 32);
      let imgs = await fetchImages(primary, Math.max(28, count), false);

      // Fallback: city-only + lenient filters if too few
      if (!cancelled && imgs.length < 12) {
        const cityOnly = Array.from(new Set(primary.map((t) => t.split(" ")[0]))).slice(0, 8);
        const more = await fetchImages(cityOnly.length ? cityOnly : primary, Math.max(28, count), true);
        if (more.length > imgs.length) imgs = more;
      }

      if (!cancelled) setImages(pad(imgs, Math.max(28, count)));
    }

    run();
    return () => { cancelled = true; };
  }, [terms, count]);

  return (
    <aside
      aria-label={`${side} photo collage`}
      className={[
        // Masonry: many small tiles
        "columns-2 md:columns-3 gap-3",
        // Keep rails visually light
        "opacity-95",
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => (
        <figure
          key={`${img.url}-${i}`}
          className="mb-3 break-inside-avoid rounded-xl bg-white/60 ring-1 ring-black/5 shadow-sm overflow-hidden"
          title={img.title || ""}
        >
          {/* Short, fixed-height tiles → no more giant posters */}
          <div className="relative w-full h-28 md:h-32">
            <Image
              src={img.url}
              alt={img.title || "Travel photo"}
              fill
              sizes="(max-width: 640px) 40vw, (max-width: 1024px) 28vw, 20vw"
              className="object-cover"
              priority={i < 6}
            />
          </div>
        </figure>
      ))}
    </aside>
  );
}
