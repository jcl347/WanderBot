// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

type Orientation = "left" | "right" | "bottom";

type Props = {
  /** Search terms to fetch images for (e.g., image_queries) */
  terms: string[];
  /** Max images to show (defaults to 12) */
  count?: number;
  /** Optional orientation for subtle layout tweaks */
  orientation?: Orientation;
  /** Extra className for the wrapper */
  className?: string;
};

type Img = {
  url: string;
  width?: number;
  height?: number;
  source?: string;
  alt?: string;
};

export default function LivePhotoPane({
  terms,
  count = 12,
  orientation = "left",
  className = "",
}: Props) {
  const [images, setImages] = React.useState<Img[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const visibleCount = Math.max(3, Math.min(24, count));

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);
      setImages(null);
      try {
        // Best-effort: POST to your images endpoint
        const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
        const res = await fetch(`${base}/api/images`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          // pass terms so server can pick the best matches
          body: JSON.stringify({
            terms: Array.from(new Set(terms)).slice(0, 16),
            count: visibleCount,
          }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`images api ${res.status}`);
        const data = await res.json();

        const imgs: Img[] = Array.isArray(data?.images)
          ? (data.images as any[])
              .map((x) => {
                if (x && typeof x.url === "string") {
                  return {
                    url: x.url as string,
                    width: Number(x.width) || undefined,
                    height: Number(x.height) || undefined,
                    source: typeof x.source === "string" ? x.source : undefined,
                    alt:
                      typeof x.alt === "string"
                        ? x.alt
                        : Array.isArray(terms) && terms.length
                        ? terms[0]
                        : "travel photo",
                  } as Img;
                }
                return null;
              })
              .filter(Boolean) as Img[]
          : [];

        if (!cancelled) setImages(imgs.slice(0, visibleCount));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load images");
      }
    }

    if (terms && terms.length) run();
    else {
      setImages([]);
    }

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(terms), visibleCount]);

  // Very simple masonry based on orientation
  const cols =
    orientation === "bottom" ? 4 : orientation === "right" ? 2 : 2;

  return (
    <div className={className}>
      {/* header chips */}
      {terms?.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {terms.slice(0, 6).map((t, i) => (
            <span
              key={i}
              className="text-xs rounded-full bg-sky-100 text-sky-700 px-2 py-0.5"
              title={t}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* loading state */}
      {!images && !error && (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: cols * 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 w-full rounded-lg bg-gray-200/70 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* error state */}
      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
          {error}
        </div>
      )}

      {/* images */}
      {images && images.length > 0 && (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
          }}
        >
          {images.map((img, i) => (
            <a
              href={img.url}
              key={i}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg overflow-hidden border border-black/5 bg-white"
            >
              {/* Use next/image for perf + automatic lazy loading. */}
              <Image
                src={img.url}
                alt={img.alt || "travel photo"}
                width={img.width || 600}
                height={img.height || 400}
                className="h-auto w-full object-cover"
                sizes={
                  orientation === "bottom"
                    ? "(max-width: 768px) 50vw, 25vw"
                    : "(max-width: 1024px) 40vw, 20vw"
                }
                // priority only for the first few on desktop rails
                priority={i < 2 && orientation !== "bottom"}
              />
            </a>
          ))}
        </div>
      )}

      {/* empty but no error */}
      {images && images.length === 0 && !error && (
        <div className="text-xs text-neutral-600">
          No images available for these terms yet.
        </div>
      )}
    </div>
  );
}
