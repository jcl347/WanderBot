"use client";

import * as React from "react";
import NextImage from "next/image";

type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
};

type Side = "left" | "right" | "bottom";

type Props = {
  /** Search terms (already city-keyword style) */
  terms: string[];
  /** How many images to show */
  count?: number;
  /** Which rail is this? Decides orientation + sizing */
  side?: Side;
  /** Extra classes */
  className?: string;
  /** Target rail width in px (used for sizes attr) */
  railWidth?: number;
  /** Tile width in px on desktop rails */
  tileWidth?: number;
};

export default function LivePhotoPane({
  terms,
  count = 18,
  side = "left",
  className = "",
  railWidth = 480,
  tileWidth = 260,
}: Props) {
  const [photos, setPhotos] = React.useState<Photo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const orientation = side === "bottom" ? "any" : "portrait";

  // Build query once
  const query = React.useMemo(() => {
    const origin =
      typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const u = new URL("/api/images", origin);
    u.searchParams.set("terms", JSON.stringify(terms.slice(0, 12)));
    u.searchParams.set("count", String(count));
    u.searchParams.set("orientation", orientation);
    return u.pathname + u.search;
  }, [terms, count, orientation]);

  // Fetch images
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await fetch(query, { cache: "force-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Photo[];
        if (!cancelled) setPhotos(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load images");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Preload top images aggressively (use DOM Image, not next/image)
  React.useEffect(() => {
    if (!photos || photos.length === 0) return;
    const top = photos.slice(0, 6);
    top.forEach((p) => {
      try {
        const img = new window.Image();
        img.src = p.src;
      } catch {
        /* no-op */
      }
    });
  }, [photos]);

  const railHeight = "calc(100vh - 8rem)";

  return (
    <div
      className={[
        "sticky top-24 overflow-y-auto",
        "rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm",
        "p-3",
        className || "",
      ].join(" ")}
      style={{ height: railHeight }}
    >
      {!photos && !error && (
        <div className="grid grid-cols-1 gap-3 animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-neutral-200" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-700">
          Couldn&apos;t load images. {error}
        </div>
      )}

      {photos && (
        <div className="grid grid-cols-1 gap-3">
          {photos.map((p, i) => {
            const w = side === "bottom" ? Math.min(640, p.width) : tileWidth;
            const ratio =
              p.width > 0 && p.height > 0 ? p.height / p.width : 2 / 3;
            const h = Math.round(w * ratio);

            return (
              <div
                key={`${p.id}-${i}`}
                className="rounded-xl overflow-hidden shadow-sm border border-neutral-200/60"
              >
                <NextImage
                  src={p.src}
                  alt={p.alt || "Travel photo"}
                  width={w}
                  height={h}
                  priority={i < 4}
                  sizes={
                    side === "bottom"
                      ? "(max-width: 768px) 100vw, 640px"
                      : `(min-width: 1024px) ${railWidth}px, 100vw`
                  }
                  className="w-full h-auto object-cover"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
