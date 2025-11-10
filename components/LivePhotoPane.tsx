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

/* ------------ helpers ------------ */
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
  const plus = /\b(mountain|alps|rockies|lake|beach|coast|ocean|harbor|valley|forest|park|trail|panorama|view|skyline|river|bay|island|waterfall|bridge|national\s+park)\b/.test(t+u);
  const minus = /\b(document|scan|logo|poster|pamphlet|map|flag|seal|diagram|book|newspaper|magazine)\b/.test(t+u);
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

function colsClass(n?: number, prefix?: string) {
  const pre = prefix ?? "";
  return n === 1 ? `${pre}grid-cols-1`
       : n === 2 ? `${pre}grid-cols-2`
       : n === 3 ? `${pre}grid-cols-3`
       : `${pre}grid-cols-2`;
}

/* ------------ component ------------ */
export default function LivePhotoPane({
  terms,
  count = 28,
  side = "left",
  className,
  cols,
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const fetched = await fetchImages(terms, Math.max(24, count));
      if (!alive) return;
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
    return () => { alive = false; };
  }, [JSON.stringify(terms), count]);

  const plan = {
    sm: cols?.sm ?? 2,
    md: cols?.md ?? 2,
    lg: cols?.lg ?? 2, // ⬅️ fewer columns => larger tiles
    xl: cols?.xl ?? 2,
  };

  // Larger vertical rhythm → bigger row units
  // We also increase row spans so tiles get visually chunky.
  const n = images.length;
  const bigN = Math.max(6, Math.floor(n * 0.40));
  const medN = Math.max(bigN + 6, Math.floor(n * 0.75));

  return (
    <aside
      aria-label={`${side} photo border`}
      className={[
        "grid grid-flow-dense gap-4 md:gap-5",
        "auto-rows-[14px] md:auto-rows-[16px]", // ⬅️ bigger base row height
        colsClass(plan.sm),
        colsClass(plan.md, "md:"),
        colsClass(plan.lg, "lg:"),
        colsClass(plan.xl, "xl:"),
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        const band = i < bigN ? "big" : i < medN ? "med" : "sm";
        const span =
          band === "big"
            ? (i % 3 === 0
                ? "col-span-2 row-span-[42] md:row-span-[48]" // wide & tall
                : i % 3 === 1
                ? "col-span-1 row-span-[52]" // tall portrait
                : "col-span-2 row-span-[38]") // wide
            : band === "med"
            ? (i % 3 === 0
                ? "col-span-1 row-span-[34]"
                : i % 3 === 1
                ? "col-span-2 row-span-[30]"
                : "col-span-1 row-span-[30]")
            : (i % 2 === 0
                ? "col-span-1 row-span-[22]"
                : "col-span-1 row-span-[24]");

        return (
          <figure
            key={`${img.url}-${i}`}
            className={[
              "rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-white/70",
              "min-h-[160px]", // ⬅️ minimum visible size
              span,
            ].join(" ")}
            title={img.title || ""}
          >
            <div className="relative w-full h-full">
              <Image
                fill
                src={img.url}
                alt={img.title || "Travel photo"}
                sizes="(max-width: 768px) 92vw, 560px" // ⬅️ match rail width
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
