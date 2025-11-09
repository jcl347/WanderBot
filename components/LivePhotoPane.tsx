"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source: "wikimedia" };

type Props = {
  terms: string[];
  count?: number;            // target number of tiles to display (we’ll fetch extra)
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

/** Lightweight in-rail filter/scorer (extra safety on top of /api/images). */
function scenicScore(img: Img): number {
  const t = `${img.title || ""} ${img.url}`.toLowerCase();

  // Demote obvious non-photos/documents
  const bad = [
    "document", "poster", "book", "cover", "scan", "page", "newspaper", "magazine",
    "manuscript", "seal", "logo", "map ", "atlas", "brochure", "pamphlet", "chart",
  ];
  if (bad.some((k) => t.includes(k))) return -5;

  // Boost scenic / landscape terms
  const scenicBoost = [
    "beach","coast","ocean","sea","bay","harbor","lagoon","island","shore",
    "mountain","alps","peak","summit","range","glacier","snow","ski",
    "valley","canyon","cliff","ridge","plateau","desert","dune",
    "lake","river","waterfall","falls","stream","fjord",
    "forest","woods","park","meadow","field","vineyard","garden",
    "skyline","cityscape","panorama","aerial","sunset","sunrise","night",
  ];

  let s = 0;
  for (const k of scenicBoost) if (t.includes(k)) s += 2;
  // Tiny bonus if looks like a photo filename
  if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(t)) s += 1;
  return s;
}

/** Ensure we never render too few tiles. */
function pad(images: Img[], n: number): Img[] {
  if (images.length >= n) return images.slice(0, n);
  const out: Img[] = [];
  for (let i = 0; i < n; i++) out.push(images[i % Math.max(1, images.length)]);
  return out;
}

/** Assign a size class based on score rank. */
function sizeClassFor(index: number, score: number, breaks: { tall: number; medium: number }) {
  // Highest scores (top N) → tall
  if (index < breaks.tall) return "h-56 md:h-64";
  // Next scores (up to medium) → medium
  if (index < breaks.medium) return "h-40 md:h-48";
  // Everything else → small
  return "h-28 md:h-32";
}

export default function LivePhotoPane({ terms, count = 36, className, side = "left" }: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      const primary = terms.slice(0, 32);
      // Fetch more than needed so we can pick better scenic ones
      const target = Math.max(40, Math.ceil(count * 1.5));

      let imgs = await fetchImages(primary, target, false);

      // Fallback: city-only + lenient filters if too few
      if (!cancelled && imgs.length < 16) {
        const cityOnly = Array.from(new Set(primary.map((t) => t.split(" ")[0]))).slice(0, 8);
        const more = await fetchImages(cityOnly.length ? cityOnly : primary, target, true);
        if (more.length > imgs.length) imgs = more;
      }

      // Score, sort by scenic score (desc), then keep top K
      const scored = imgs
        .map((im) => ({ im, s: scenicScore(im) }))
        .sort((a, b) => b.s - a.s)
        .map(({ im }) => im);

      const picked = scored.slice(0, Math.max(28, count));
      if (!cancelled) setImages(pad(picked, Math.max(28, count)));
    }

    run();
    return () => { cancelled = true; };
  }, [terms, count]);

  // Precompute breaks: top ~25% tall, next ~35% medium, rest small.
  const n = images.length;
  const tallN = Math.max(6, Math.floor(n * 0.25));
  const medN  = Math.max(tallN + 6, Math.floor(n * 0.60)); // cumulative
  const breaks = { tall: tallN, medium: medN };

  return (
    <aside
      aria-label={`${side} photo collage`}
      className={[
        // Masonry (CSS columns). We keep 3 columns to keep tiles small.
        "columns-2 md:columns-3 gap-3",
        // Softened background look
        "opacity-95",
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        // Give earlier tiles larger sizes (already scenic-sorted)
        const heightClass = sizeClassFor(i, 0, breaks);

        // Add a subtle stagger to reduce perfect rows (rotate size on modulo)
        const jitter = i % 7 === 0 ? "md:h-72" : i % 5 === 0 ? "md:h-56" : "";

        return (
          <figure
            key={`${img.url}-${i}`}
            className="mb-3 break-inside-avoid rounded-xl bg-white/60 ring-1 ring-black/5 shadow-sm overflow-hidden"
            title={img.title || ""}
          >
            <div className={`relative w-full ${heightClass} ${jitter}`}>
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
        );
      })}
    </aside>
  );
}
