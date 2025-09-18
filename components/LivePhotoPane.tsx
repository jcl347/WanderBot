// components/LivePhotoPane.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Img = {
  url: string;
  title?: string;
  source?: string;
  license?: string;
};

type Props =
  | {
      /** (Legacy) A single freeform query; we’ll simplify it to “City <word>” internally. */
      query: string;
      count?: number;
      className?: string;
    }
  | {
      /** New: explicit city + list of short terms (e.g., ["South Beach","Nightlife","Wynwood Walls","art scene"]) */
      city: string;
      terms: string[];
      count?: number;
      className?: string;
    };

/** Keep only distinct by URL */
function uniqueByUrl(arr: Img[]): Img[] {
  const seen = new Set<string>();
  const out: Img[] = [];
  for (const it of arr) {
    if (!it?.url) continue;
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

/** Given a messy freeform query, collapse to “City Term” (first two tokens). */
function simplifyFreeform(q: string): string {
  if (!q) return "";
  const words = q.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(" "); // "Miami South" / "Las Vegas Strip"
}

/** Build the set of dead-simple queries. */
function buildQueries(p: Props, total: number): string[] {
  if ("city" in p) {
    const city = (p.city || "").trim();
    const cleanTerms = (p.terms || [])
      .map((t) => String(t || "").trim())
      .filter(Boolean);
    // If no terms, just use the city itself
    const base = cleanTerms.length ? cleanTerms : [""];
    // “City + term” only (term can be empty => “City”)
    const qs = base.map((t) => `${city}${t ? " " + t : ""}`.trim());
    // Cap the number of parallel queries so we don’t over-fetch
    return qs.slice(0, Math.max(1, Math.min(6, qs.length)));
  } else {
    const s = simplifyFreeform(p.query);
    return s ? [s] : [];
  }
}

/** Fetch images for ONE simple query via your /api/images endpoint */
async function fetchImagesForTerm(term: string, want: number): Promise<Img[]> {
  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: term, count: want }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({ images: [] }));
  return Array.isArray(json?.images) ? (json.images as Img[]) : [];
}

export default function LivePhotoPane(props: Props) {
  const { count = 12, className = "" } = props as any;
  const [imgs, setImgs] = useState<Img[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Precompute very simple queries: ["Miami South Beach", "Miami Nightlife", ...]
  const simpleQueries = useMemo(() => buildQueries(props, count), [props, count]);

  // IntersectionObserver to only load once visible (nice perf boost)
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setErr(null);

        if (simpleQueries.length === 0) {
          setImgs([]);
          return;
        }

        // Allocate a target per term; we’ll slightly over-ask to survive duds.
        const perTerm = Math.max(3, Math.ceil(count / Math.max(1, simpleQueries.length))) + 2;

        // Fetch all terms in parallel, merge, dedupe
        const batches = await Promise.all(
          simpleQueries.map((term) => fetchImagesForTerm(term, perTerm))
        );
        let merged = uniqueByUrl(batches.flat());

        // Fallback: if we got almost nothing, try just the bare city (first token of first query).
        if (merged.length < Math.min(6, count) && simpleQueries[0]) {
          const cityOnly = simpleQueries[0].split(/\s+/)[0];
          if (cityOnly) {
            const extra = await fetchImagesForTerm(cityOnly, Math.max(count, 12));
            merged = uniqueByUrl([...merged, ...extra]);
          }
        }

        // Trim to count
        merged = merged.slice(0, count);

        if (!cancelled) setImgs(merged);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load images");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // Intentionally only depend on the list, not err/loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad, simpleQueries.join("|"), count]);

  // --- render ---

  return (
    <div ref={rootRef} className={`w-full h-full ${className}`}>
      {/* Collage grid — varied sizes for visual interest */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 auto-rows-[90px] md:auto-rows-[110px]">
        {imgs.map((im, i) => {
          // Make some cells larger to create a collage feeling
          const span =
            i % 7 === 0
              ? "col-span-2 row-span-2"
              : i % 5 === 0
              ? "col-span-2"
              : "";

        return (
          <div
            key={im.url + i}
            className={`relative rounded-xl overflow-hidden bg-neutral-200 ${span}`}
          >
            <Image
              src={im.url}
              alt={im.title || "Photo"}
              fill
              sizes="(max-width: 768px) 33vw, 260px"
              className="object-cover"
              // First few get priority for snappier LCP
              priority={i < 4}
              // Modern browsers decode off-thread; avoid layout jank
              loading={i < 4 ? "eager" : "lazy"}
            />
            {/* Optional subtle gradient & caption on hover */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity" />
            {im.title ? (
              <div className="pointer-events-none absolute bottom-1 left-1 right-1 text-[10px] md:text-xs text-white/90 line-clamp-1 drop-shadow">
                {im.title}
              </div>
            ) : null}
          </div>
        );
        })}

        {/* Skeletons while loading / or if empty */}
        {loading && imgs.length === 0
          ? Array.from({ length: Math.max(6, Math.min(12, count)) }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="rounded-xl bg-neutral-200/70 animate-pulse"
                style={{ height: i % 7 === 0 ? 220 : 110 }}
              />
            ))
          : null}
      </div>

      {!loading && imgs.length === 0 && (
        <div className="text-xs text-neutral-500 mt-2">
          No images found for: {simpleQueries.join(", ")}
        </div>
      )}

      {err && (
        <div className="text-xs text-rose-600 mt-2">
          Image error: {err}
        </div>
      )}
    </div>
  );
}
