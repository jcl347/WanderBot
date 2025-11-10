// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source: "wikimedia" };

type Props = {
  terms: string[];
  count?: number;
  className?: string;
  side?: "left" | "right";
};

function hashToInt(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickVariant(term: string) {
  const n = hashToInt(term) % 100;
  if (n < 50) return "square" as const;    // 50%
  if (n < 80) return "landscape" as const; // 30%
  return "portrait" as const;              // 20%
}

async function fetchBatch(terms: string[], count: number, lenient = false): Promise<Img[]> {
  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      terms,
      count,
      source: "wikimedia",
      // tell your route it's ok to relax filtering if needed
      lenient,
    }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const imgs = (Array.isArray(json?.images) ? json.images : []).filter((x: any) => x?.url) as Img[];
  return imgs;
}

export default function LivePhotoPane({ terms, count = 36, className, side = "left" }: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const primary = terms.slice(0, 32);

    async function run() {
      // 1) primary try
      let imgs = await fetchBatch(primary, Math.max(24, count), false);

      // 2) fallback if too few → re-query with city-only simplified terms & lenient filter
      if (!cancelled && imgs.length <= 8) {
        const cityOnly = Array.from(new Set(primary.map((t) => t.split(" ")[0])).values()).slice(0, 6);
        const more = await fetchBatch(cityOnly.length ? cityOnly : primary, Math.max(24, count), true);
        if (more.length > imgs.length) imgs = more;
      }

      if (!cancelled) setImages(imgs.slice(0, Math.max(24, count)));
    }

    run();
    return () => { cancelled = true; };
  }, [terms, count]);

  return (
    <aside
      aria-label={`${side} photo collage`}
      className={[
        "grid grid-flow-dense gap-3",
        // more columns so many tiles appear at once
        "grid-cols-2 sm:grid-cols-3 md:grid-cols-3",
        // small base row → tight masonry
        "auto-rows-[6px]",
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        const term = terms[i % Math.max(1, terms.length)] || "";
        const variant = pickVariant(term);

        // keep spans bounded to avoid a single enormous tile
        const spec =
          variant === "square"
            ? { wrap: "aspect-square", col: "col-span-1", row: "row-span-[22]" }     // ~132px
            : variant === "landscape"
            ? { wrap: "aspect-[4/3]",    col: "col-span-2", row: "row-span-[22]" }
            : { wrap: "aspect-[3/4]",    col: "col-span-1", row: "row-span-[28]" }; // a bit taller

        return (
          <figure
            key={`${img.url}-${i}`}
            className={[
              "overflow-hidden rounded-xl bg-white/60 shadow-sm",
              "ring-1 ring-black/5",
              spec.col,
              spec.row,
            ].join(" ")}
            title={img.title || ""}
          >
            <div className={spec.wrap}>
              <Image
                src={img.url}
                alt={img.title || "Travel photo"}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 20vw"
                className="object-cover"
                priority={i < 4}
              />
            </div>
          </figure>
        );
      })}
    </aside>
  );
}
