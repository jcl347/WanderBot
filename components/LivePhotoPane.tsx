// components/LivePhotoPane.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type ApiImage = {
  url: string;
  title?: string;
  source?: string;
  license?: string;
};

type Props = {
  query: string;
  count?: number;
  /** purely for subtle style shifts if you want them */
  orientation?: "left" | "right";
  /** when to trigger fetching; keep stable/memoized to avoid lint warnings */
  rootMargin?: string;
  className?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** simple <img> fallback, rarely used once next.config images are set */
function RawImg({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    // width/height attributes help prevent CLS even in fallback
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover rounded-xl"
    />
  );
}

export default function LivePhotoPane({
  query,
  count = 10,
  orientation,
  rootMargin = "200px",
  className = "",
}: Props) {
  const [imgs, setImgs] = useState<ApiImage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // keep this stable to quiet the lint rule
  const memoRootMargin = useMemo(() => rootMargin, [rootMargin]);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;

    const el = ref.current;
    const obs = new IntersectionObserver(
      async (entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        if (!vis || cancelled || fetched) return;

        try {
          setFetched(true);
          const res = await fetch("/api/images", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ q: query, count }),
            cache: "no-store",
          });
          if (!res.ok) {
            setErr(`HTTP ${res.status}`);
            return;
          }
          const data = (await res.json()) as { images?: ApiImage[] };
          setImgs(Array.isArray(data.images) ? data.images : []);
        } catch (e: any) {
          setErr(e?.message || "fetch_failed");
        }
      },
      { rootMargin: memoRootMargin }
    );

    obs.observe(el);
    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [query, count, memoRootMargin, fetched]);

  // Skeleton while waiting to intersect/fetch
  if (!imgs) {
    return (
      <div
        ref={ref}
        className={cx(
          "grid grid-cols-2 gap-2 md:gap-3 auto-rows-[120px] md:auto-rows-[140px]",
          className
        )}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cx(
              "rounded-xl bg-neutral-200/70 animate-pulse",
              i % 5 === 0 && "col-span-2",
              i % 7 === 0 && "row-span-2"
            )}
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (imgs.length === 0) {
    return (
      <div
        className={cx(
          "rounded-xl border bg-white/60 text-sm text-neutral-500 p-4",
          className
        )}
        ref={ref}
      >
        No images found for <span className="font-medium">“{query}”</span>.
      </div>
    );
  }

  // Collage grid:
  // - explicit auto-rows height guarantees non-zero height for fill images
  // - varied spans make a mosaic
  return (
    <div
      ref={ref}
      className={cx(
        "grid grid-cols-2 gap-2 md:gap-3 auto-rows-[120px] md:auto-rows-[140px]",
        className
      )}
      aria-label={`image collage ${orientation ?? ""}`.trim()}
    >
      {imgs.slice(0, count).map((im, i) => {
        // pattern the spans for a lively layout
        const span =
          i % 7 === 0
            ? "col-span-2"
            : i % 5 === 0
            ? "row-span-2"
            : undefined;

        const priority = i < 3; // preload a few for snappy LCP
        const alt = im.title || `Photo ${i + 1}`;

        return (
          <figure
            key={im.url + i}
            className={cx(
              "relative rounded-xl overflow-hidden shadow-sm bg-neutral-100",
              // give each item height via auto-rows + (optional) row/col spans
              span
            )}
          >
            {/* Keep an intrinsic area with aspect if this card spans both columns */}
            <div className="absolute inset-0" />
            {/* Prefer next/image; if domain config is missing, it’ll error in dev — fallback <img> keeps UI alive */}
            <Image
              src={im.url}
              alt={alt}
              fill
              sizes="(min-width: 768px) 260px, 50vw"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className="object-cover"
              onError={(e) => {
                const el = (e.target as HTMLImageElement).parentElement;
                if (!el) return;
                // Replace with a raw <img> fallback
                el.innerHTML = "";
                const fallback = document.createElement("img");
                fallback.src = im.url;
                fallback.alt = alt;
                fallback.loading = priority ? "eager" : "lazy";
                fallback.decoding = "async";
                fallback.className = "absolute inset-0 h-full w-full object-cover rounded-xl";
                el.appendChild(fallback);
              }}
            />
            {/* Optional tiny overlay – license/source if you want it visible
            <figcaption className="absolute bottom-0 left-0 right-0 bg-black/30 text-[10px] text-white px-1 py-0.5 truncate">
              {im.license || ""}{im.source ? " • " : ""}{im.source ? "Wikimedia" : ""}
            </figcaption>
            */}
          </figure>
        );
      })}
    </div>
  );
}
