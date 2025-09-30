"use client";

import * as React from "react";
import Image from "next/image";
import clsx from "clsx";

// Props: `orientation` is optional; we just use it for DOM attributes/classes
type Props = {
  terms: string[];
  count?: number;
  orientation?: "left" | "right";
  className?: string;
};

type ApiImage = {
  src: string;
  width?: number | null;
  height?: number | null;
  title?: string | null;
  page?: string | null;
  author?: string | null;
  license?: string | null;
};

function useImageSearch(terms: string[], count: number) {
  const [images, setImages] = React.useState<ApiImage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      if (!terms?.length) {
        setImages([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        terms.forEach((t) => qs.append("terms", t));
        qs.set("count", String(count));
        const res = await fetch(`/api/images?${qs.toString()}`, {
          method: "GET",
          // Leverage the route's SWR caching
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          console.error("[LivePhotoPane] /api/images error:", data);
          setError("Image API error");
          setImages([]);
          return;
        }

        const imgs: ApiImage[] = Array.isArray(data?.images) ? data.images : [];
        console.log("[LivePhotoPane] terms=", terms, "returned=", imgs.length, "reqId=", data?.reqId);

        // Preload top N to speed up first paint
        const preload = imgs.slice(0, Math.min(6, imgs.length));
        for (const im of preload) {
          try {
            // 1) <link rel="preload" as="image">
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "image";
            link.href = im.src;
            document.head.appendChild(link);

            // 2) JS warmup (fills HTTP cache even if link rel is ignored)
            const i = new window.Image();
            i.src = im.src;
          } catch {}
        }

        setImages(imgs);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[LivePhotoPane] fetch threw:", e);
        setError(e?.message || "Network error");
        setImages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Start during idle time if possible
    // (we still run immediately if rIC isn't available)
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(doFetch, { timeout: 1200 });
    } else {
      doFetch();
    }

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(terms), count]);

  return { images, loading, error };
}

export default function LivePhotoPane({
  terms,
  count = 18,
  orientation,
  className = "",
}: Props) {
  const { images, loading, error } = useImageSearch(terms, count);

  // Extra roomy layout so the rails feel “wide” and not cramped.
  // Each tile uses a 4:5-ish portrait ratio, perfect for side rails.
  return (
    <aside
      data-orientation={orientation || "rail"}
      className={clsx(
        "rounded-2xl bg-white/70 backdrop-blur sticky top-20",
        "p-3 md:p-3 border shadow-inner",
        "min-h-[1400px] max-h-[calc(100vh-6rem)] overflow-y-auto",
        className
      )}
      aria-busy={loading ? "true" : "false"}
    >
      <div className="grid grid-cols-1 gap-3">
        {images.map((im, idx) => {
          // First few are eager/priority to boost LCP for the side rails
          const eager = idx < 2;
          return (
            <figure
              key={im.src + "-" + idx}
              className="relative w-full overflow-hidden rounded-xl border bg-white"
              style={{ aspectRatio: "4 / 5" }} // stable layout to avoid CLS
            >
              <Image
                src={im.src}
                alt={im.title || "Photo"}
                fill
                sizes="(max-width: 1024px) 50vw, 320px"
                className="object-cover"
                priority={eager}
                loading={eager ? "eager" : "lazy"}
              />
              {im.title && (
                <figcaption className="absolute bottom-0 left-0 right-0 bg-white/70 text-[11px] px-2 py-1 line-clamp-1">
                  {im.title}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>

      {!images.length && !loading && !error && (
        <div className="text-xs text-neutral-500 p-2">
          No images found for: <span className="font-mono">{terms.join(", ")}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-600 p-2">
          {error} — check server logs for /api/images.
        </div>
      )}
    </aside>
  );
}
