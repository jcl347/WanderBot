// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source: "wikimedia" };

type RailCols = {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

type Props = {
  terms: string[];
  /** Optional maximum images to try to fetch (server may cap) */
  count?: number;
  /** Responsive columns for the rail */
  cols?: RailCols;
  className?: string;
};

function isLikelyPhoto(u: string) {
  const url = u.toLowerCase();
  // client-side belt-and-suspenders: avoid documents/maps/logos
  const bad =
    url.includes("logo") ||
    url.includes("seal") ||
    url.includes("emblem") ||
    url.includes("flag_of") ||
    url.includes("map") ||
    url.includes(".svg"); // many wikimedia svgs are non-photos
  return !bad;
}

export default function LivePhotoPane({
  terms,
  count = 60,
  cols,
  className,
}: Props) {
  const [imgs, setImgs] = React.useState<Img[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // Default: a dense but readable rail, flush by default
  const c = {
    base: cols?.base ?? 2,
    sm: cols?.sm ?? 2,
    md: cols?.md ?? 3,
    lg: cols?.lg ?? 3,
    xl: cols?.xl ?? 4,
  };

  const gridClasses = [
    "grid",
    "gap-2", // small gap; the outer collage can control additional spacing
    // responsive column counts
    `grid-cols-${Math.max(1, c.base)}`,
    `sm:grid-cols-${Math.max(1, c.sm)}`,
    `md:grid-cols-${Math.max(1, c.md)}`,
    `lg:grid-cols-${Math.max(1, c.lg)}`,
    `xl:grid-cols-${Math.max(1, c.xl)}`,
  ].join(" ");

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr(null);
      setImgs(null);

      const clean = (terms || [])
        .map((t) => String(t || "").trim())
        .filter(Boolean);
      if (clean.length === 0) {
        setImgs([]);
        return;
      }

      // Use pipe to separate (safe + server can split)
      const qs = new URLSearchParams({
        terms: clean.join("|"),
        count: String(Math.max(1, Math.min(200, count))),
        source: "wikimedia",
      });

      const url = `/api/images?${qs.toString()}`;
      console.log("[LivePhotoPane] fetching:", url);

      try {
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) {
          const txt = await res.text().catch(() => String(res.status));
          console.warn("[LivePhotoPane] non-OK:", res.status, txt);
          if (!cancelled) setErr(`${res.status} fetching images`);
          return;
        }
        const json = await res.json();
        const list: Img[] = Array.isArray(json?.images)
          ? json.images
              .filter((x: any) => x && typeof x.url === "string")
              .map((x: any) => ({
                url: x.url as string,
                title: typeof x.title === "string" ? x.title : undefined,
                source: "wikimedia" as const,
              }))
          : [];

        const filtered = list.filter((im) => isLikelyPhoto(im.url));
        console.log(
          "[LivePhotoPane] fetched:",
          list.length,
          "filtered:",
          filtered.length
        );

        if (!cancelled) setImgs(filtered);
      } catch (e: any) {
        console.error("[LivePhotoPane] fetch error:", e?.message || e);
        if (!cancelled) setErr(e?.message || "images fetch failed");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(terms), count]);

  // Simple responsive "card" sizes for visual variance—no overlap
  // We use a few tall/medium/short classes to break monotony.
  function sizeClass(ix: number) {
    // Heuristic: every 7th is tall, every 3rd is medium, rest short
    if (ix % 7 === 0) return "row-span-2 h-64 md:h-80";
    if (ix % 3 === 0) return "h-48 md:h-56";
    return "h-40 md:h-44";
  }

  return (
    <div className={className}>
      {err && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mb-2">
          Couldn’t load images: {err}
        </div>
      )}

      {!imgs && (
        <div className={gridClasses}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-neutral-200 rounded-xl w-full h-36 md:h-40"
            />
          ))}
        </div>
      )}

      {imgs && imgs.length === 0 && (
        <div className="text-neutral-500 text-sm">
          No images found for these terms.
        </div>
      )}

      {imgs && imgs.length > 0 && (
        <div className={gridClasses}>
          {imgs.map((im, i) => (
            <figure
              key={`${im.url}-${i}`}
              className={[
                "relative overflow-hidden rounded-xl",
                "bg-neutral-100",
                sizeClass(i),
              ].join(" ")}
            >
              <Image
                src={im.url}
                alt={im.title || "Destination photo"}
                fill
                sizes="(max-width: 768px) 40vw, (max-width: 1280px) 25vw, 20vw"
                className="object-cover"
                loading={i < 6 ? "eager" : "lazy"}
                // Make Next.js less strict about external sizes
                unoptimized={false}
              />
              {im.title && (
                <figcaption className="absolute bottom-0 left-0 right-0 bg-black/30 text-[10px] text-white px-2 py-1 truncate">
                  {im.title}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
