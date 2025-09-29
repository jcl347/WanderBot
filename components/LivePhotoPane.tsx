// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
};

type Props = {
  /** Search terms to guide the images API */
  terms: string[];
  /** Target number of images to show */
  count?: number;
  /** Which rail is this? Affects orientation hint + sizes */
  side?: "left" | "right";
  /** Extra classes for the scroll container */
  className?: string;
  /** Optional seed photos to render immediately (server provided) */
  initial?: Photo[];
};

const BLUR =
  "data:image/svg+xml;charset=utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><filter id='b'><feGaussianBlur stdDeviation='1.5' /></filter><rect width='10' height='10' fill='#e5f2ff' filter='url(#b)'/></svg>`
  );

export default function LivePhotoPane({
  terms,
  count = 24,
  side = "left",
  className = "",
  initial,
}: Props) {
  const [photos, setPhotos] = React.useState<Photo[] | null>(initial || null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch (or refetch) images. We hint side for better aspect picks.
  React.useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        const url = new URL("/api/images", window.location.origin);
        url.searchParams.set("terms", JSON.stringify(terms.slice(0, 14)));
        url.searchParams.set("count", String(count));
        url.searchParams.set("side", side === "right" ? "landscape" : "portrait");

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { "cache-control": "max-age=60" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Photo[] = await res.json();
        setPhotos((prev) => (prev && prev.length ? prev : json));
        // Preload early items for instant paint
        for (const p of json.slice(0, 6)) {
          const img = new window.Image();
          img.decoding = "async";
          img.loading = "eager";
          img.src = p.src;
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e?.message || "Failed to load images");
      }
    };
    if (!initial || !initial.length) run();
    return () => controller.abort();
  }, [terms, count, side, initial]);

  // “Rail” sizing: big cells with generous padding
  const sizes =
    side === "right"
      ? "(min-width:1536px) 460px, (min-width:1280px) 420px, (min-width:1024px) 360px, 100vw"
      : "(min-width:1536px) 460px, (min-width:1280px) 420px, (min-width:1024px) 360px, 100vw";

  return (
    <aside
      className={[
        "rounded-2xl border bg-white/60 backdrop-blur sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto",
        "shadow-sm hover:shadow-md transition-shadow",
        "p-3",
        className,
      ].join(" ")}
      aria-busy={!photos && !error}
    >
      {!photos && !error && (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-700">
          Couldn’t load photos. {error}
        </div>
      )}

      {photos && (
        <div className="grid gap-3">
          {photos.map((p, i) => {
            const eager = i < 4; // eager-load first few
            const ratio = Math.max(1, p.width) / Math.max(1, p.height);
            // keep tall feel on left, wide feel on right, but always big
            const h =
              side === "right"
                ? Math.max(240, Math.min(420, Math.round(340 / Math.max(1, ratio))))
                : Math.max(300, Math.min(520, Math.round(420 * (1 / Math.max(1, ratio)))));

            return (
              <figure key={p.id} className="rounded-xl overflow-hidden border bg-white/70">
                <Image
                  src={p.src}
                  alt={p.alt || ""}
                  width={p.width || 1200}
                  height={p.height || 800}
                  // Fill rail width with large visible images
                  sizes={sizes}
                  priority={eager}
                  placeholder="blur"
                  blurDataURL={BLUR}
                  style={{
                    width: "100%",
                    height: `${h}px`,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {p.alt && (
                  <figcaption className="px-3 py-2 text-xs text-neutral-700 line-clamp-2">
                    {p.alt}
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      )}
    </aside>
  );
}
