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

export default function LivePhotoPane({
  terms,
  count = 18,
  className = "",
  side = "left",
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ terms, count }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`images: ${res.status}`);
        const json = await res.json();
        const imgs: Img[] = Array.isArray(json?.images)
          ? json.images.filter((x: any) => x?.url)
          : [];
        if (!cancelled) setImages(imgs);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "image fetch failed");
        // soft fail; keep UI
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(terms), count]);

  // Subtle alignment bias so the edges feel “anchored”
  const justify =
    side === "left" ? "items-start text-left" : "items-end text-right";

  return (
    <aside
      className={`w-full ${className}`}
      aria-label={side === "left" ? "left photo rail" : "right photo rail"}
    >
      {/* Masonry-ish: use CSS columns; avoid layout thrash */}
      <div
        className={`columns-2 xl:columns-3 gap-3 ${justify}`}
        style={{ columnFill: "balance" as any }}
      >
        {images.map((im, i) => (
          <figure key={`${im.url}-${i}`} className="mb-3 break-inside-avoid">
            <div className="relative w-full overflow-hidden rounded-xl shadow-sm">
              {/* Use a fixed aspect ratio container for smooth paint */}
              <div className="relative w-full" style={{ paddingTop: "70%" }}>
                <Image
                  src={im.url}
                  alt={im.title || "Travel photo"}
                  fill
                  sizes="(max-width: 1024px) 40vw, 20vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </figure>
        ))}
      </div>
      {err && (
        <div className="mt-2 text-xs text-neutral-500">
          (Images delayed: {err})
        </div>
      )}
    </aside>
  );
}
