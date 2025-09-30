"use client";

import * as React from "react";
import Image from "next/image";
import clsx from "clsx";

type Props = {
  terms: string[];
  count?: number;
  /** purely cosmetic for data-attributes/testing */
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

  // Make dependencies stable for the effect
  const depKey = React.useMemo(() => `${terms.join("\u0001")}|${count}`, [terms, count]);

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
        const url = `/api/images?${qs.toString()}`;

        const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          console.error("[LivePhotoPane] /api/images error:", { status: res.status, data });
          setError(`Image API error (${res.status})`);
          setImages([]);
          return;
        }

        const imgs: ApiImage[] = Array.isArray(data?.images) ? data.images : [];
        console.log(
          "[LivePhotoPane] fetched",
          imgs.length,
          "images for",
          terms,
          "reqId=",
          data?.reqId
        );

        // aggressively warm up the first few
        if (typeof window !== "undefined") {
          const preload = imgs.slice(0, Math.min(6, imgs.length));
          for (const im of preload) {
            try {
              const link = document.createElement("link");
              link.rel = "preload";
              link.as = "image";
              link.href = im.src;
              document.head.appendChild(link);

              const i = new window.Image();
              i.decoding = "async";
              i.loading = "eager";
              i.src = im.src;
              // @ts-ignore - not all browsers support decode()
              if (i.decode) i.decode().catch(() => {});
            } catch {}
          }
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

    // Defer a bit so main content paints first
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(doFetch, { timeout: 1500 });
    } else {
      doFetch();
    }

    return () => {
      cancelled = true;
    };
  }, [depKey]);

  return { images, loading, error };
}

export default function LivePhotoPane({
  terms,
  count = 18,
  orientation,
  className = "",
}: Props) {
  const { images, loading, error } = useImageSearch(terms, count);

  return (
    <aside
      data-orientation={orientation || "rail"}
      className={clsx(
        "rounded-2xl bg-white/70 backdrop-blur",
        "p-3 md:p-3 border shadow-inner",
        "min-h-[1400px] max-h-[calc(100vh-6rem)] overflow-y-auto",
        className
      )}
      aria-busy={loading ? "true" : "false"}
    >
      {/* grid of images */}
      <div className="grid grid-cols-1 gap-3">
        {images.map((im, idx) => {
          const eager = idx < 2;
          return (
            <figure
              key={`${im.src}-${idx}`}
              className="relative w-full overflow-hidden rounded-xl border bg-white"
              style={{ aspectRatio: "4 / 5" }}
            >
              <Image
                src={im.src}
                alt={im.title || "Photo"}
                fill
                sizes="(max-width: 1024px) 50vw, 360px"
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

      {/* Empty / error states */}
      {loading && images.length === 0 && (
        <div className="mt-2 grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && !error && images.length === 0 && (
        <div className="text-xs text-neutral-500 p-2">
          No images found for: <span className="font-mono break-all">{terms.join(", ")}</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 p-2">
          {error}. Check server logs for <code>/api/images</code>.
        </div>
      )}
    </aside>
  );
}
