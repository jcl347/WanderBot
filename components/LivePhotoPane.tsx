"use client";

import * as React from "react";
import Image from "next/image";
import clsx from "clsx";

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

  // Build a stable dependency key to satisfy react-hooks/exhaustive-deps
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
        const res = await fetch(`/api/images?${qs.toString()}`, {
          method: "GET",
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
        console.log(
          "[LivePhotoPane] terms=",
          terms,
          "returned=",
          imgs.length,
          "reqId=",
          data?.reqId
        );

        // Preload first few
        const preload = imgs.slice(0, Math.min(6, imgs.length));
        for (const im of preload) {
          try {
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "image";
            link.href = im.src;
            document.head.appendChild(link);

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

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(doFetch, { timeout: 1200 });
    } else {
      doFetch();
    }

    return () => {
      cancelled = true;
    };
  }, [depKey]); // ← single stable dependency

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
        "rounded-2xl bg-white/70 backdrop-blur sticky top-20",
        "p-3 md:p-3 border shadow-inner",
        "min-h-[1400px] max-h-[calc(100vh-6rem)] overflow-y-auto",
        className
      )}
      aria-busy={loading ? "true" : "false"}
    >
      <div className="grid grid-cols-1 gap-3">
        {images.map((im, idx) => {
          const eager = idx < 2;
          return (
            <figure
              key={im.src + "-" + idx}
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
