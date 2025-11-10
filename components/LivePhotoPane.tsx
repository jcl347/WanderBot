"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source: "wikimedia" | "openverse" };
type RailCols = { sm?: number; md?: number; lg?: number; xl?: number };
type Props = {
  terms: string[];
  count?: number;
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
    if (!res.ok) return [];
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
  } catch {
    return [];
  }
}

function scenicScore(img: Img): number {
  const t = (img.title || "").toLowerCase();
  const u = (img.url || "").toLowerCase();
  const plus = /\b(mountain|alps|rockies|canyon|lake|beach|coast|ocean|harbor|valley|forest|park|trail|panorama|view|skyline|river|bay|island|waterfall|bridge|national\s+park|scenic|landscape)\b/.test(
    t + u
  );
  const minus = /\b(document|scan|poster|logo|map|flag|seal|book|magazine|newspaper|pamphlet|diagram)\b/.test(
    t + u
  );
  return (plus ? 2 : 0) - (minus ? 2 : 0);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function colsClass(n?: number, prefix = "") {
  return n === 1
    ? `${prefix}grid-cols-1`
    : n === 2
    ? `${prefix}grid-cols-2`
    : n === 3
    ? `${prefix}grid-cols-3`
    : `${prefix}grid-cols-4`;
}

/* ---------------- component ---------------- */
export default function LivePhotoPane({
  terms,
  count = 60,
  side = "left",
  className,
  cols,
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const fetched = await fetchImages(terms, Math.max(60, count));
      if (!alive) return;

      // scenic first, but keep variety
      const scored = fetched.map((im) => ({ im, s: scenicScore(im) }));
      const buckets = scored.reduce<Record<number, Img[]>>((acc, { im, s }) => {
        (acc[s] ||= []).push(im);
        return acc;
      }, {});
      const ranks = Object.keys(buckets).map(Number).sort((a, b) => b - a);
      const scenicFirst: Img[] = [];
      for (const r of ranks) scenicFirst.push(...shuffle(buckets[r]));
      setImages(scenicFirst);
    })();
    return () => {
      alive = false;
    };
  }, [JSON.stringify(terms), count]);

  const plan = {
    sm: cols?.sm ?? 2,
    md: cols?.md ?? 3,
    lg: cols?.lg ?? 3,
    xl: cols?.xl ?? 4,
  };

  // No row-span = no overlap. We vary ONLY column span and aspect ratio.
  // Scenic images occasionally get a wider slot (col-span-2) on large screens.
  const variants: Array<{ cls: string; aspect: string; scenicWide?: boolean }> = [
    { cls: "", aspect: "aspect-[4/3]" },
    { cls: "", aspect: "aspect-square" },
    { cls: "", aspect: "aspect-[3/4]" },
    { cls: "lg:col-span-2", aspect: "aspect-[16/10]", scenicWide: true },
    { cls: "", aspect: "aspect-[4/3]" },
    { cls: "", aspect: "aspect-square" },
    { cls: "", aspect: "aspect-[3/4]" },
    { cls: "lg:col-span-2", aspect: "aspect-[16/9]", scenicWide: true },
  ];

  const pickVariant = (i: number) => variants[i % variants.length];

  return (
    <div
      aria-label={`${side} photo border`}
      className={[
        "grid grid-flow-row dense",
        "gap-6 md:gap-7", // ⬅️ visible gaps so nothing feels crowded
        colsClass(plan.sm),
        colsClass(plan.md, "md:"),
        colsClass(plan.lg, "lg:"),
        colsClass(plan.xl, "xl:"),
        "overflow-visible",
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        const v = pickVariant(i);
        const isScenic = scenicScore(img) > 0;
        const colSpan = isScenic && v.scenicWide ? "lg:col-span-2" : v.cls;

        const figureCls = [
          // shadow + ring + rounded for clear separation (no visual overlap)
          "rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-white/70",
          v.aspect,
          colSpan,
        ].join(" ");

        return (
          <figure key={`${img.url}-${i}`} className={figureCls} title={img.title || ""}>
            <div className="relative w-full h-full">
              <Image
                fill
                src={img.url}
                alt={img.title || "Travel photo"}
                sizes="(max-width: 768px) 100vw, 920px"
                className="object-cover"
                priority={i < 8}
              />
            </div>
          </figure>
        );
      })}
    </div>
  );
}
