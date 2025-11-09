"use client";

import * as React from "react";
import Image from "next/image";

type Img = {
  url: string;
  title?: string;
  source: "wikimedia" | "openverse";
};

type RailCols = {
  sm?: number; // default 2
  md?: number; // default 2
  lg?: number; // default 3
  xl?: number; // default 3
};

type Props = {
  terms: string[];
  count?: number;               // how many to fetch; we still display big tiles
  side?: "left" | "right";
  className?: string;
  cols?: RailCols;
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

function scenicScore(img: Img): number {
  const t = (img.title || "").toLowerCase();
  const u = (img.url || "").toLowerCase();

  const plus =
    /\b(mountain|alps|rockies|lake|beach|coast|ocean|sea|harbor|valley|forest|park|trail|panorama|view|skyline|national\s+park|river|bay|cliff|desert|island|waterfall|bridge|castle|cathedral|old\s?town|harbour)\b/.test(
      t
    ) ||
    /\b(mountain|lake|beach|coast|ocean|sea|harbor|valley|forest|park|trail|panorama|view|skyline|river|bay|cliff|desert|island|waterfall|bridge|castle|cathedral|oldtown|harbour)\b/.test(
      u
    );

  const minus =
    /\b(document|scan|logo|poster|pamphlet|map|flag|seal|diagram|chart|newspaper|magazine|book|manuscript|catalog)\b/.test(
      t
    ) ||
    /\b(document|scan|logo|poster|pamphlet|map|flag|seal|diagram|chart|book|catalog)\b/.test(
      u
    );

  return (plus ? 2 : 0) - (minus ? 2 : 0);
}

function shuffle<T>(arr: T[], rnd = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function colsClass(n?: number, prefix?: string) {
  switch (n) {
    case 1:
      return `${prefix ?? ""}grid-cols-1`;
    case 2:
      return `${prefix ?? ""}grid-cols-2`;
    case 3:
      return `${prefix ?? ""}grid-cols-3`;
    case 4:
      return `${prefix ?? ""}grid-cols-4`;
    default:
      return `${prefix ?? ""}grid-cols-2`;
  }
}

/* ---------------- component ---------------- */

export default function LivePhotoPane({
  terms,
  count = 26,
  side = "left",
  className,
  cols,
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const fetched = await fetchImages(terms, Math.max(18, count));
      if (!alive || !fetched.length) return;

      // Scenic first, then everything else; keep some randomness
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

  // Column plan for “photo border” rails:
  //  - small screens: 2 cols
  //  - md: 2 cols (bigger tiles)
  //  - lg+: 3 cols (varied boarder look)
  const plan = {
    sm: cols?.sm ?? 2,
    md: cols?.md ?? 2,
    lg: cols?.lg ?? 3,
    xl: cols?.xl ?? 3,
  };

  // Tile sizing bands → span rules (masonry-ish by grid)
  // Use grid-auto-rows for consistent vertical rhythm.
  // Big tiles occupy more vertical span to feel “featured”.
  const n = images.length;
  const bigN = Math.max(6, Math.floor(n * 0.35));
  const medN = Math.max(bigN + 6, Math.floor(n * 0.7));

  return (
    <aside
      aria-label={`${side} photo border`}
      className={[
        // base grid
        "grid auto-rows-[10px] grid-flow-dense gap-3 md:gap-4",
        colsClass(plan.sm),
        colsClass(plan.md, "md:"),
        colsClass(plan.lg, "lg:"),
        colsClass(plan.xl, "xl:"),
        "opacity-95",
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        const band = i < bigN ? "big" : i < medN ? "med" : "sm";

        // Row/col spans (masonry style). Bigger/landscape for top scenic items.
        const span =
          band === "big"
            ? i % 3 === 0
              ? "col-span-2 row-span-[30] md:row-span-[36]" // wide & tall
              : i % 3 === 1
              ? "col-span-1 row-span-[36]" // tall portrait
              : "col-span-2 row-span-[28]" // wide
            : band === "med"
            ? i % 3 === 0
              ? "col-span-1 row-span-[28]"
              : i % 3 === 1
              ? "col-span-2 row-span-[24]"
              : "col-span-1 row-span-[24]"
            : i % 2 === 0
            ? "col-span-1 row-span-[18]"
            : "col-span-1 row-span-[20]";

        // Container tunes: border radius + soft ring so photos pop
        return (
          <figure
            key={`${img.url}-${i}`}
            className={[
              "rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-white/70",
              // Ensure grid spans work even when columns shrink
              "min-h-[140px]",
              // Span class
              span,
            ].join(" ")}
            title={img.title || ""}
          >
            <div className="relative w-full h-full">
              <Image
                fill
                src={img.url}
                alt={img.title || "Travel photo"}
                // Don’t overconstrain sizes: rails are narrow; let browser pick
                sizes="(max-width: 768px) 92vw, 420px"
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
