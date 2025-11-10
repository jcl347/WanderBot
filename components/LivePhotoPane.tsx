// components/LivePhotoPane.tsx
// Masonary-style with varied pictures
"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source: "wikimedia" };
type Props = {
  terms: string[];
  count?: number;             // target images to show
  className?: string;
  side?: "left" | "right";    // purely for aria/semantics
};

/** Tiny hash to pick a stable variant per term (prevents layout jumpiness). */
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
  // ~50% square, 30% landscape, 20% portrait
  if (n < 50) return "square" as const;
  if (n < 80) return "landscape" as const;
  return "portrait" as const;
}

export default function LivePhotoPane({ terms, count = 18, className, side = "left" }: Props) {
  const [images, setImages] = React.useState<Img[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Ask our images API for a batch (Wikimedia-only)
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            terms: terms.slice(0, 24),
            count: Math.max(count, 18),
            source: "wikimedia",
          }),
        });
        if (!res.ok) return;
        const json = await res.json();
        const imgs = (Array.isArray(json?.images) ? json.images : [])
          .filter((x: any) => x?.url)
          .slice(0, Math.max(count, 18)) as Img[];

        if (!cancelled) setImages(imgs);
      } catch {
        /* ignore */
      }
    }

    run();
    return () => { cancelled = true; };
  }, [terms, count]);

  return (
    <aside
      aria-label={`${side} photo collage`}
      className={[
        "grid grid-flow-dense gap-3",
        "grid-cols-2 sm:grid-cols-2 md:grid-cols-3",
        "auto-rows-[8px]",                // base row height for masonry math
        className || "",
      ].join(" ")}
    >
      {images.map((img, i) => {
        const term = terms[i % Math.max(1, terms.length)] || "";
        const variant = pickVariant(term);

        // Translate variant → grid spans + aspect ratio wrapper.
        // Using auto-rows: 8px; so row-span approximates height.
        const spec =
          variant === "square"
            ? { wrap: "aspect-square", col: "col-span-1", row: "row-span-[16]" } // ~128px
            : variant === "landscape"
            ? { wrap: "aspect-[4/3]",    col: "col-span-2", row: "row-span-[16]" }
            : { wrap: "aspect-[3/4]",    col: "col-span-1", row: "row-span-[20]" };

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
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 18vw"
                className="object-cover"
                // eager for first few, lazy for the rest
                priority={i < 3}
              />
            </div>
          </figure>
        );
      })}
    </aside>
  );
}
