// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

/** Minimal image shape returned by /api/images */
type Img = {
  url: string;
  title?: string;
  source: "wikimedia" | "openverse";
};

type Props = {
  /** Search terms to fetch photos for (already city-focused) */
  terms: string[];
  /** Rough target number of images (actual can be higher/lower) */
  count?: number;
  /** Which rail this is, for a11y */
  side?: "left" | "right";
  /** Extra classes on the outer <aside> */
  className?: string;
};

/** Fetch images from our server endpoint with light dedupe. */
async function fetchImages(terms: string[], count: number): Promise<Img[]> {
  if (!terms?.length) return [];
  try {
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ terms, count }),
      cache: "force-cache",
    });
    if (!res.ok) {
      console.warn("[LivePhotoPane] /api/images non-OK:", res.status);
      return [];
    }
    const data = await res.json();
    const raw: Img[] = Array.isArray(data?.images) ? data.images : [];
    // Deduplicate by URL
    const seen = new Set<string>();
    const out: Img[] = [];
    for (const im of raw) {
      if (!im?.url || seen.has(im.url)) continue;
      seen.add(im.url);
      out.push(im);
    }
    return out;
  } catch (e) {
    console.warn("[LivePhotoPane] /api/images error:", e);
    return [];
  }
}

/** Very simple "scenic" heuristic to bias natural landscapes larger. */
function scenicScore(img: Img): number {
  const t = (img.title || "").toLowerCase();
  const u = (img.url || "").toLowerCase();
  const bonus = (s: string) =>
    /\b(mountain|mountains|lake|beach|coast|coastal|ocean|sea|harbor|harbour|skyline|valley|forest|trail|park|scenic|panorama|view|overlook|national\s+park)\b/.test(
      s
    )
      ? 1
      : 0;

  const penalty = (s: string) =>
    /\b(document|scan|manuscript|logo|poster|flyer|pamphlet|map|flag|seal|diagram|chart|typography|newspaper|magazine)\b/.test(
      s
    )
      ? 1
      : 0;

  return bonus(t) + bonus(u) - penalty(t) - penalty(u);
}

/** Assign a size class based on score rank (less tall overall). */
function sizeClassFor(index: number, breaks: { tall: number; medium: number }) {
  if (index < breaks.tall) return "h-44 md:h-52"; // scenic “hero”, not too tall
  if (index < breaks.medium) return "h-32 md:h-40"; // mid tiles
  return "h-24 md:h-28"; // small fillers
}

/** Small Fisher–Yates shuffle to avoid monotony among equal scores. */
function shuffle<T>(arr: T[], rnd = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function LivePhotoPane({
  terms,
  count = 36,
  side = "left",
  className,
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const fetched = await fetchImages(terms, Math.max(24, count));
      if (!alive || !fetched.length) return;

      // Sort by scenic score (desc) with a light shuffle among equals
      const scored = fetched.map((im) => ({ im, s: scenicScore(im) }));
      const grouped = scored.reduce<Record<number, Img[]>>((acc, { im, s }) => {
        acc[s] ||= [];
        acc[s].push(im);
        return acc;
      }, {});
      const scores = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => b - a);
      const scenicFirst: Img[] = [];
      for (const sc of scores) scenicFirst.push(...shuffle(grouped[sc]));

      setImages(scenicFirst);
    })();
    return () => {
      alive = false;
    };
  }, [JSON.stringify(terms), count]);

  const n = images.length;
  // Fewer talls, more mediums: avoids “ski-slope” rails while keeping some heroes
  const tallN = Math.max(4, Math.floor(n * 0.18));
  const medN = Math.max(tallN + 6, Math.floor(n * 0.68)); // cumulative
  const breaks = { tall: tallN, medium: medN };

  return (
    <aside
      aria-label={`${side} photo collage`}
      className={[
        // More columns on xl to naturally shorten the perceived tile height
        "columns-2 md:columns-3 xl:columns-4 gap-2 md:gap-3",
        "opacity-95",
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        const baseH = sizeClassFor(i, breaks);

        // Shape jitter: some squares and 4:3 short wides to break vertical rhythm
        const jitter =
          i % 9 === 0
            ? "aspect-[4/3] h-auto"
            : i % 7 === 0
            ? "aspect-square h-auto"
            : "";

        return (
          <figure
            key={`${img.url}-${i}`}
            className="mb-2 md:mb-3 break-inside-avoid rounded-xl bg-white/60 ring-1 ring-black/5 shadow-sm overflow-hidden"
            title={img.title || ""}
          >
            <div className={`relative w-full ${jitter ? jitter : baseH}`}>
              <Image
                // When we use an aspect-* jitter, use intrinsic sizing not fill
                fill={!jitter}
                src={img.url}
                alt={img.title || "Travel photo"}
                sizes={
                  jitter
                    ? "(max-width: 640px) 40vw, (max-width: 1024px) 28vw, 20vw"
                    : "(max-width: 640px) 40vw, (max-width: 1024px) 28vw, 20vw"
                }
                className={jitter ? "w-full h-auto object-cover" : "object-cover"}
                priority={i < 6}
              />
            </div>
          </figure>
        );
      })}
    </aside>
  );
}
