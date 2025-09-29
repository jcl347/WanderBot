"use client";

import * as React from "react";
import Image from "next/image";
import clsx from "clsx";

/** Simple photo shape returned by /api/images */
type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
};

/** In-memory cache so switching pages doesn’t refetch */
const memory = new Map<string, Photo[]>();

type Props = {
  terms: string[];
  /** target number of images to show */
  count?: number;
  /** "left" | "right" just for data-attributes and future styling hooks */
  orientation?: "left" | "right";
  /** Tailwind classes for the wrapper */
  className?: string;
  /** Pixel height of each tile (rail). Defaults to 260px. */
  tileHeight?: number;
  /** Optional: make images even larger on xl+ screens */
  xlBigger?: boolean;
};

/** tiny 1x1 blur to avoid layout shifts (keeps it light) */
const BLUR =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=";

export default function LivePhotoPane({
  terms,
  count = 12,
  orientation = "left",
  className = "",
  tileHeight = 260,
  xlBigger = true,
}: Props) {
  const key = React.useMemo(
    () => JSON.stringify({ t: [...new Set(terms.map((t) => t.trim().toLowerCase()))], c: count }),
    [terms, count]
  );

  const [photos, setPhotos] = React.useState<Photo[]>(
    () => memory.get(key) ?? []
  );
  const [loading, setLoading] = React.useState(!memory.has(key));
  const [error, setError] = React.useState<string | null>(null);

  // Fetch as soon as mounted (no need to wait for intersection for rails)
  React.useEffect(() => {
    let cancelled = false;
    async function go() {
      if (memory.has(key)) {
        setPhotos(memory.get(key)!);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const u = new URL("/api/images", window.location.origin);
        // pass terms as comma string (route supports both comma and JSON)
        u.searchParams.set("terms", terms.join(","));
        u.searchParams.set("count", String(count));
        // prefer tall-ish images for rails
        u.searchParams.set("orientation", "portrait");
        const res = await fetch(u.toString(), {
          headers: { "x-rail": orientation },
          cache: "force-cache",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Photo[] = await res.json();
        if (!cancelled) {
          memory.set(key, data);
          setPhotos(data);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load images");
          setLoading(false);
        }
      }
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [key, terms, count, orientation]);

  // Skeletons while loading — match final tile height so there’s no jank
  const skeletons = Array.from({ length: Math.min(count, 8) }, (_, i) => (
    <div
      key={`s-${i}`}
      className="w-full animate-pulse rounded-xl bg-neutral-200/70"
      style={{ height: tileHeight }}
    />
  ));

  const railSizes =
    "(min-width:1536px) 560px, (min-width:1280px) 520px, (min-width:1024px) 480px, 100vw";

  const railClasses = clsx(
    "grid gap-4",
    // one big image per row; rails feel more premium vs mosaic thumbs
    "grid-cols-1",
    className
  );

  return (
    <section
      className={railClasses}
      data-rail={orientation}
      aria-label={`${orientation} photo rail`}
    >
      {loading && skeletons}

      {!loading && error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        photos.slice(0, count).map((p, idx) => {
          // Give the first few tiles priority for instant paint
          const priority = idx < 2;
          // Make tiles a bit taller on xl+ if desired
          const h =
            xlBigger && typeof window === "undefined"
              ? tileHeight
              : tileHeight;

          return (
            <div
              key={p.id || p.src || idx}
              className="relative w-full overflow-hidden rounded-xl border border-neutral-200 bg-white"
              style={{ height: h }}
            >
              <Image
                src={p.src}
                alt={p.alt || ""}
                fill
                sizes={railSizes}
                // cover so tall rails look great
                style={{ objectFit: "cover" }}
                // small blur to smooth-in
                placeholder="blur"
                blurDataURL={BLUR}
                // speed up above-the-fold
                priority={priority}
              />
            </div>
          );
        })}
    </section>
  );
}
