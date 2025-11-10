// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source: "wikimedia" };

type Props = {
  terms: string[];
  className?: string;
  /** Optional: force a certain number of columns for the rail at different breakpoints */
  cols?: { base?: number; sm?: number; md?: number; lg?: number; xl?: number };
};

/** Heuristic: “scenic” if term includes these keywords => bigger tile */
const SCENIC_HINTS = [
  "beach","coast","sea","ocean","bay","harbor","harbour","lake","river","waterfall",
  "island","mountain","peak","alps","glacier","park","forest","trail","canyon","valley",
  "skyline","old town","historic center","plaza","square","promenade","pier","cliffs",
  "desert","dunes","botanical","garden","coastline","bridge","castle","cathedral","temple"
];

function isScenicTerm(term: string) {
  const t = term.toLowerCase();
  return SCENIC_HINTS.some(k => t.includes(k));
}

/** Hit our images endpoint for a term list */
async function fetchImages(terms: string[]): Promise<Img[]> {
  try {
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ terms, count: 64 }) // pull a bunch; the grid will choose what to show
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.images) ? json.images.slice(0, 64) : [];
  } catch {
    return [];
  }
}

export default function LivePhotoPane({ terms, className, cols }: Props) {
  const [images, setImages] = React.useState<Img[]>([]);
  React.useEffect(() => {
    let on = true;
    fetchImages(terms).then((imgs) => { if (on) setImages(imgs || []); });
    return () => { on = false; };
  }, [terms.join("|")]);

  // Column utilities (default 3 on large, 2 on small)
  const colBase = cols?.base ?? 2;
  const colSm   = cols?.sm   ?? 2;
  const colMd   = cols?.md   ?? 2;
  const colLg   = cols?.lg   ?? 3;
  const colXl   = cols?.xl   ?? 3;

  // We’ll render tiles with “dense” packing and zero gap so they’re perfectly flush.
  // Variation comes from aspect ratios + occasional column spans.
  return (
    <div
      className={[
        "grid grid-flow-dense gap-0",                       // flush, dense grid
        `grid-cols-${colBase}`,
        `sm:grid-cols-${colSm}`,
        `md:grid-cols-${colMd}`,
        `lg:grid-cols-${colLg}`,
        `xl:grid-cols-${colXl}`,
        className || ""
      ].join(" ")}
      style={{ contain: "layout paint size" }}
      aria-hidden
    >
      {images.map((im, i) => {
        const scenic = isScenicTerm(terms[i % terms.length] || "");
        // Scenic = bigger & wider; otherwise mix of squares/portrait/video
        // Use CSS aspect-ratio to avoid any whitespace.
        const sizeClass = scenic
          ? "col-span-2 aspect-[4/3] md:col-span-2" // wide scenic tile
          : (i % 3 === 0 ? "aspect-square" : i % 3 === 1 ? "aspect-[3/4]" : "aspect-video");

        return (
          <div key={`${im.url}-${i}`} className={["relative overflow-hidden", sizeClass].join(" ")}>
            <Image
              src={im.url}
              alt={im.title || "destination photo"}
              fill
              className="object-cover select-none pointer-events-none"
              sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 20vw"
              priority={i < 6}
            />
          </div>
        );
      })}
    </div>
  );
}
