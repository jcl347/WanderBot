"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Head from "next/head";

// ---------- Types ----------
type Img = { url: string; title?: string; source?: string; license?: string };

type Props =
  | { query: string; count?: number; city?: never; terms?: never; orientation?: "left" | "right" }
  | { city?: string; terms: string[]; count?: number; query?: never; orientation?: "left" | "right" };

// ---------- Tiny cache so we don't re-fetch on route change ----------
const memoryCache = new Map<string, Img[]>();

function cacheKey(p: Props) {
  if ("query" in p) return `q:${p.query}|n:${p.count || 12}`;
  const city = (p as any)?.city || "";
  const terms = Array.isArray((p as any)?.terms) ? (p as any).terms.join(",") : "";
  return `city:${city}|terms:${terms}|n:${p.count || 12}`;
}

// ---------- In-view hook (no deps) ----------
function useInView<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setIsInView(true);
            obs.disconnect();
          }
        });
      },
      { root: null, rootMargin, threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, isInView };
}

// ---------- Preload first few images ----------
function PreloadLinks({ images }: { images: Img[] }) {
  const first3 = images.slice(0, 3);
  return (
    <>
      {/* Preconnect improves TLS warm-up for Commons */}
      <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
      {first3.map((im, i) => (
        <link key={i} rel="preload" as="image" href={im.url} fetchPriority="high" />
      ))}
    </>
  );
}

// ---------- Randomized grid helpers ----------
const sizeClasses = [
  // w,h spans for the CSS grid (more variety looks “collage-y”)
  "col-span-2 row-span-2", // big
  "col-span-2 row-span-1", // wide
  "col-span-1 row-span-2", // tall
  "col-span-1 row-span-1", // small
];

function pickSize(i: number) {
  // deterministic “randomness” from index
  const idx = (i * 9301 + 49297) % sizeClasses.length;
  return sizeClasses[idx];
}

// ---------- Skeleton ----------
function TileSkeleton() {
  return (
    <div className="animate-pulse bg-neutral-200/70 dark:bg-neutral-800/40 rounded-xl w-full h-full" />
  );
}

// ---------- Component ----------
export default function LivePhotoPane(props: Props) {
  const count = Math.max(6, Math.min(props.count ?? 12, 20));
  const key = useMemo(() => cacheKey(props), [props]);
  const [images, setImages] = useState<Img[] | null>(memoryCache.get(key) ?? null);
  const [loading, setLoading] = useState(!memoryCache.has(key));
  const [err, setErr] = useState<string | null>(null);

  const { ref, isInView } = useInView<HTMLDivElement>("200px");

  useEffect(() => {
    if (images || !isInView) return;

    const controller = new AbortController();
    const doFetch = async () => {
      try {
        setLoading(true);
        setErr(null);

        const body =
          "query" in props
            ? { q: props.query, count }
            : { city: props.city || "", terms: props.terms, count };

        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
          keepalive: true,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: Img[] = Array.isArray(data?.images) ? data.images : [];
        memoryCache.set(key, list);
        setImages(list);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Failed to load images");
        }
      } finally {
        setLoading(false);
      }
    };

    doFetch();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, key]);

  // Build the grid items (bigger, varied)
  const items = (images ?? []).slice(0, count);

  return (
    <div ref={ref} className="relative">
      <Head>
        {/* Preload the first few actual images once we have them */}
        {images && images.length > 0 ? <PreloadLinks images={images} /> : null}
      </Head>

      <div
        className={[
          // Masonry-ish responsive grid on each side rail
          "grid gap-3",
          "grid-cols-3 auto-rows-[110px]",
          "sm:grid-cols-4 sm:auto-rows-[120px]",
          "lg:grid-cols-5 lg:auto-rows-[140px]",
        ].join(" ")}
      >
        {/* Loading skeleton */}
        {loading && !images && (
          <>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className={`rounded-xl overflow-hidden ${pickSize(i)} min-h-[100px]`}
              >
                <TileSkeleton />
              </div>
            ))}
          </>
        )}

        {/* Error state */}
        {err && !loading && (
          <div className="col-span-full text-sm text-red-600">
            Couldn’t load images: {err}
          </div>
        )}

        {/* Real images */}
        {items.map((im, i) => (
          <div
            key={im.url || i}
            className={[
              "relative overflow-hidden rounded-2xl",
              "bg-neutral-100 dark:bg-neutral-900",
              "shadow-sm",
              pickSize(i),
            ].join(" ")}
          >
            <Image
              src={im.url}
              alt={im.title || "Destination photo"}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              priority={i < 2}                 // boost first couple
              loading={i < 2 ? "eager" : "lazy"}
              decoding="async"
              style={{ objectFit: "cover" }}
              // If your next.config doesn’t allow Commons yet, add:
              // images: { remotePatterns: [{ protocol: 'https', hostname: 'upload.wikimedia.org' }] }
              unoptimized
            />
            {/* subtle overlay title for accessibility / context (optional) */}
            {im.title ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-2">
                <div className="text-xs text-white/90 line-clamp-1">{im.title.replace(/^File:/, "")}</div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
