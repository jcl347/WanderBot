// components/DestinationCard.tsx
"use client";

import Link from "next/link";
import * as React from "react";
import Image from "next/image";

type Dest = {
  slug: string;
  name: string;
  narrative: string;
  analysis?: {
    image_queries?: string[];
    photos?: string[];
    highlights?: string[];
    best_month?: string;
    avoid_months?: string[];
  };
  highlights?: string[];
  best_month?: string;
  avoid_months?: string[];
};

export default function DestinationCard({
  dest,
  href,
}: {
  dest: Dest | any; // tolerate older shapes
  href: string;
}) {
  const analysis = dest?.analysis ?? {};
  const highlights: string[] = dest?.highlights ?? analysis?.highlights ?? [];
  const bestMonth: string | undefined = dest?.best_month ?? analysis?.best_month;
  const avoidMonths: string[] = dest?.avoid_months ?? analysis?.avoid_months ?? [];

  // 1) Prefer a model-provided photo if present
  const modelPhoto: string | null =
    Array.isArray(analysis?.photos) && analysis.photos[0] ? String(analysis.photos[0]) : null;

  // 2) Else use the first image query to fetch one Wikimedia image via our API
  const firstQuery: string | undefined = Array.isArray(analysis?.image_queries)
    ? analysis.image_queries[0]
    : undefined;

  const [preview, setPreview] = React.useState<string | null>(modelPhoto);

  React.useEffect(() => {
    let cancelled = false;
    if (preview || !firstQuery) return;

    const fetchPreview = async () => {
      try {
        const url = `/api/images?terms=${encodeURIComponent(firstQuery)}&count=1&where=card`;
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) return;
        const json = await res.json();

        // Our /api/images returns { images: [{ src, title, ... }], trace? }
        const img = json?.images?.[0]?.src ?? json?.results?.[0]?.src;
        if (img && !cancelled) setPreview(String(img));
      } catch (e) {
        // Non-fatal — just render text card
        console.warn("[DestinationCard] preview fetch failed:", e);
      }
    };

    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [firstQuery, preview]);

  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-2xl border bg-white/80 backdrop-blur shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {/* Image header (optional) */}
      {preview ? (
        <div className="relative h-48 w-full">
          <Image
            src={preview}
            alt={`${dest?.name ?? "Destination"} preview`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            priority={false}
          />
        </div>
      ) : null}

      {/* Text content */}
      <div className="p-4 md:p-5">
        <h3 className="text-sky-900 font-semibold">{dest?.name}</h3>
        <p className="mt-1 text-sm text-neutral-700 leading-relaxed line-clamp-5">
          {dest?.narrative}
        </p>

        {/* Meta chips */}
        {(bestMonth || (avoidMonths && avoidMonths.length > 0)) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {bestMonth && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">
                <span aria-hidden>✅</span>
                <span className="font-medium">Best month:</span>
                <span>{bestMonth}</span>
              </span>
            )}
            {avoidMonths.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-800">
                <span aria-hidden>⚠️</span>
                <span className="font-medium">Avoid:</span>
                <span>{avoidMonths.join(", ")}</span>
              </span>
            )}
          </div>
        )}

        {/* Fun highlights */}
        {Array.isArray(highlights) && highlights.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-sky-900">
              Fun stuff at this location
            </div>
            <ul className="flex flex-wrap gap-2">
              {highlights.slice(0, 6).map((h, i) => (
                <li
                  key={`${h}-${i}`}
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800"
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Link>
  );
}
