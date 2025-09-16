// components/LiveCollage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

/**
 * Use like:
 *   <LiveCollage side="left"  dest={dest} />
 *   <LiveCollage side="right" dest={dest} />
 *
 * It builds multiple DDG queries from the destination’s:
 * - name / city / country
 * - analysis.image_queries (from the LLM, if present)
 * - highlights, map_markers, and nouns pulled from narrative
 *
 * Then it calls /api/images?queries=[...] and renders a collage.
 * The container reserves height so the center analytics never jump.
 */

type Props = {
  side: "left" | "right";
  dest: any; // same shape you pass to DestDetailClient
  max?: number; // how many images to show in this column
  className?: string;
};

type Img = { url: string; title?: string };

function tokens(narr: string, max = 8): string[] {
  const words = (narr || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s,/-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !["with", "that", "this", "from", "into", "near", "over", "under"].includes(w));
  // crude "importance": frequency
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

export default function LiveCollage({ side, dest, max = 8, className }: Props) {
  const [imgs, setImgs] = useState<Img[] | null>(null);

  const queries = useMemo(() => {
    const q: string[] = [];

    const name = (dest?.name || "").trim();
    if (name) q.push(`${name} skyline`, `${name} landmarks`, `${name} nightlife`, `${name} nature`);

    const analysis = dest?.analysis || {};
    const hl: string[] = Array.isArray(analysis.highlights) ? analysis.highlights : [];
    const markers: string[] = Array.isArray(analysis.map_markers)
      ? (analysis.map_markers as any[]).map((m) => m?.name).filter(Boolean)
      : [];

    const llmQs: string[] = Array.isArray(analysis.image_queries) ? analysis.image_queries : [];

    // narrative tokens to bias local themes
    const narrTokens = tokens(dest?.narrative || "");

    // merge with bias toward variety
    const mixes = [
      ...llmQs.map((x) => `${name} ${x}`),
      ...hl.map((x) => `${name} ${x}`),
      ...markers.map((x) => `${name} ${x}`),
      ...narrTokens.map((x) => `${name} ${x}`),
    ]
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    // fallback if everything above is empty
    if (!mixes.length) mixes.push(`${name} travel highlights`, `${name} attractions`);

    // Trim to avoid over-fetch; server dedupes anyway
    return Array.from(new Set(mixes)).slice(0, 12);
  }, [dest]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setImgs(null); // show skeleton
        const url =
          "/api/images?count=" +
          encodeURIComponent(String(max)) +
          "&queries=" +
          encodeURIComponent(JSON.stringify(queries));
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setImgs(Array.isArray(json.images) ? json.images : []);
      } catch {
        if (!cancelled) setImgs([]);
      }
    }
    if (queries.length) run();
    return () => {
      cancelled = true;
    };
  }, [queries, max]);

  return (
    <aside
      className={[
        "sticky top-6 h-[calc(100vh-3rem)] overflow-auto rounded-xl border bg-white/80 backdrop-blur-sm p-3",
        "shadow-sm",
        "min-w-[240px]",
        className || "",
      ].join(" ")}
      aria-label={side === "left" ? "Vibe check" : "More views"}
    >
      <div className="text-sm font-medium mb-2">{side === "left" ? "Vibe check" : "More views"}</div>

      {/* Skeleton keeps layout stable while fetching */}
      {!imgs && (
        <div className="grid gap-2">
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className="rounded-xl bg-neutral-200/60 animate-pulse aspect-[4/3]" />
          ))}
        </div>
      )}

      {imgs && imgs.length === 0 && (
        <div className="text-xs text-neutral-500">No live images found.</div>
      )}

      {imgs && imgs.length > 0 && (
        <div className="grid gap-2">
          {imgs.map((im: Img, i: number) => (
            <div key={`${i}-${im.url}`} className="overflow-hidden rounded-xl border bg-white/60 aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={im.url}
                alt={im.title || ""}
                className="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.03]"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
