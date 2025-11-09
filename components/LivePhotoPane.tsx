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
  /** Search terms (already city-centric) */
  terms: string[];
  /** Rough target number of images */
  count?: number;
  /** For a11y labeling (optional) */
  side?: "left" | "right";
  /** Extra classes for outer container */
  className?: string;
};

/* ---------------- helpers ---------------- */

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
    // dedupe by URL
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

/** lightweight “is it scenery?” heuristic */
function scenicScore(img: Img): number {
  const t = (img.title || "").toLowerCase();
  const u = (img.url || "").toLowerCase();
  const plus =
    /\b(mountain|lake|beach|coast|ocean|sea|harbor|valley|forest|park|trail|panorama|view|skyline|national\s+park|river|bay)\b/.test(
      t
    ) ||
    /\b(mountain|lake|beach|coast|ocean|sea|harbor|valley|forest|park|trail|panorama|view|skyline|river|bay)\b/.test(
      u
    );
  const minus =
    /\b(document|scan|logo|poster|pamphlet|map|flag|seal|diagram|chart|newspaper|magazine)\b/.test(
      t
    ) || /\b(document|scan|logo|poster|pamphlet|map|flag|seal|diagram|chart)\b/.test(u);
  return (plus ? 1 : 0) - (minus ? 1 : 0);
}

/** shuffle to avoid monotony among same scores */
function shuffle<T>(arr: T[], rnd = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------- component ---------------- */

export default function LivePhotoPane({
  terms,
  count = 28, // fewer, bigger tiles
  side = "left",
  className,
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const fetched = await fetchImages(terms, Math.max(18, count));
      if (!alive || !fetched.length) return;

      // sort by scenic score, shuffle equals
      const scored = fetched.map((im) => ({ im, s: scenicScore(im) }));
      const buckets = scored.reduce<Record<number, Img[]>>((acc, { im, s }) => {
        (acc[s] ||= []).push(im);
        return acc;
      }, {});
      const ranks = Object.keys(buckets)
        .map(Number)
        .sort((a, b) => b - a);
      const scenicFirst: Img[] = [];
      for (const r of ranks) scenicFirst.push(...shuffle(buckets[r]));

      setImages(scenicFirst);
    })();
    return () => {
      alive = false;
    };
  }, [JSON.stringify(terms), count]);

  // We want 1–2 per row → use CSS grid with two columns on md+,
  // single column on very small screens.
  // Then vary height/shape by index, giving scenic-first items more area.
  const n = images.length;
  const bigN = Math.max(4, Math.floor(n * 0.35)); // many larges to keep it bold
  const medN = Math.max(bigN + 6, Math.floor(n * 0.75)); // cumulative middle band

  return (
    <aside
      aria-label={`${side} photo collage`}
      className={[
        // 1 col on small, 2 col on md+ for large, bold tiles
        "grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4",
        "opacity-95",
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        // size band
        const band = i < bigN ? "big" : i < medN ? "med" : "sm";

        // shape variety (mix wides, squares, portrait)
        // Keep overall heights generous; ensure not “too tall”.
        const shape =
          band === "big"
            ? i % 3 === 0
              ? "aspect-[16/10]" // wide scenic hero
              : i % 3 === 1
              ? "aspect-square"
              : "aspect-[4/5]"
            : band === "med"
            ? i % 2 === 0
              ? "aspect-[4/3]"
              : "aspect-square"
            : i % 3 === 0
            ? "aspect-[5/4]"
            : "aspect-square";

        // height caps (so nothing becomes a skyscraper)
        const height =
          band === "big"
            ? "max-h-[18rem] md:max-h-[22rem]"
            : band === "med"
            ? "max-h-[14rem] md:max-h-[17rem]"
            : "max-h-[11rem] md:max-h-[13rem]";

        return (
          <figure
            key={`${img.url}-${i}`}
            className="rounded-2xl bg-white/70 ring-1 ring-black/5 shadow-sm overflow-hidden"
            title={img.title || ""}
          >
            <div className={`relative w-full ${shape} ${height}`}>
              <Image
                fill
                src={img.url}
                alt={img.title || "Travel photo"}
                sizes="(max-width: 768px) 90vw, 38vw"
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
