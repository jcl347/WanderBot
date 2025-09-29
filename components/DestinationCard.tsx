// components/DestinationCard.tsx
"use client";
import Link from "next/link";
import React from "react";
import NextImage from "next/image";

export default function DestinationCard({
  dest,
  href,
}: {
  dest: any;
  href: string;
}) {
  const analysis = dest.analysis ?? {};
  const highlights: string[] = dest.highlights ?? analysis.highlights ?? [];
  const bestMonth: string | undefined = dest.best_month ?? analysis.best_month;
  const avoidMonths: string[] = dest.avoid_months ?? analysis.avoid_months ?? [];

  // Grab first query for preview
  const previewQuery: string | undefined = Array.isArray(analysis.image_queries)
    ? analysis.image_queries[0]
    : undefined;
  const previewUrl = previewQuery
    ? `/api/images?q=${encodeURIComponent(previewQuery)}&count=1`
    : null;

  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!previewUrl) return;
      try {
        const res = await fetch(previewUrl, { cache: "force-cache" });
        if (!res.ok) return;
        const json = await res.json();
        const img = json?.images?.[0]?.url;
        if (img && !cancelled) setPreview(img);
      } catch (e) {
        console.warn("preview image fetch failed", e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  return (
    <Link
      href={href}
      className="block rounded-2xl border bg-gradient-to-br from-white to-sky-50/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      {preview && (
        <div className="relative w-full h-48">
          <NextImage
            src={preview}
            alt={`${dest.name} preview`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="p-4">
        <div className="font-semibold text-sky-900">{dest.name}</div>
        <p className="mt-1 text-sm text-neutral-700 line-clamp-5">
          {dest.narrative}
        </p>

        <div className="mt-3 grid gap-2 text-xs">
          {bestMonth && (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 px-2 py-1">
              <span>✅ Best month:</span>
              <span className="font-medium">{bestMonth}</span>
            </div>
          )}
          {avoidMonths.length > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 text-rose-800 px-2 py-1">
              <span>⚠️ Avoid:</span>
              <span className="font-medium">{avoidMonths.join(", ")}</span>
            </div>
          )}
        </div>

        {highlights.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-sky-900 mb-1">
              Fun stuff at this location
            </div>
            <ul className="flex flex-wrap gap-2">
              {highlights.slice(0, 6).map((h, i) => (
                <li
                  key={i}
                  className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-xs"
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
