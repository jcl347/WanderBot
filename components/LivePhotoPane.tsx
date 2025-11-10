// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import Image from "next/image";

type ImgItem = { url: string; alt: string };

type Props = {
  terms: string[];
  count?: number;
  className?: string;
  columns?: number;      // how many columns in the mosaic (desktop)
  rowSize?: number;      // base row height used for auto-rows (px)
};

export default function LivePhotoPane({
  terms,
  count = 18,
  className = "",
  columns = 3,
  rowSize = 92,
}: Props) {
  const [items, setItems] = React.useState<ImgItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Build a stable key for deps to keep ESLint happy without re-fetching too often
  const termKey = React.useMemo(() => terms.join(" | "), [terms]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!terms || terms.length === 0) {
        setItems([]);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            // Prefer Wikimedia/Openverse providers server-side
            terms,
            count,
          }),
          // No-store to keep rails fresh across different destinations
          cache: "no-store",
        });
        if (!res.ok) {
          console.warn("[LivePhotoPane] /api/images non-OK:", res.status);
          setItems([]);
          return;
        }
        const json = await res.json();
        const urls: string[] = Array.isArray(json?.images)
          ? json.images
              .map((im: any) => (im && typeof im.url === "string" ? im.url : null))
              .filter(Boolean)
          : [];
        const out: ImgItem[] = urls.slice(0, count).map((u) => ({
          url: u,
          alt: terms[0] || "travel image",
        }));
        if (!cancelled) {
          // log for debugging (why images might not appear)
          console.log("[LivePhotoPane] fetched images:", out);
          setItems(out);
        }
      } catch (e) {
        console.warn("[LivePhotoPane] fetch error:", (e as Error).message);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Only refetch when the set of terms or count change materially
  }, [termKey, count]);

  // Simple patterned collage: make a repeating span pattern for variety.
  // We use a CSS grid with fixed auto-rows to get masonry-like blocks via row-span.
  const slotClass = (i: number) => {
    // cycle over a 10-item pattern
    switch (i % 10) {
      case 0:
        return "col-span-2 row-span-2";
      case 1:
        return "row-span-1";
      case 2:
        return "row-span-2";
      case 3:
        return "row-span-1";
      case 4:
        return "col-span-2 row-span-1";
      case 5:
        return "row-span-1";
      case 6:
        return "row-span-2";
      case 7:
        return "row-span-1";
      case 8:
        return "col-span-2 row-span-1";
      default:
        return "row-span-1";
    }
  };

  return (
    <aside
      className={`w-full ${className}`}
      aria-label="Travel photo collage"
      data-testid="live-photo-pane"
    >
      <div
        className={`grid gap-2`}
        style={{
          gridTemplateColumns: `repeat(${Math.max(2, columns)}, minmax(0, 1fr))`,
          gridAutoRows: `${rowSize}px`,
        }}
      >
        {items.map((im, i) => {
          const eager = i < 6; // aggressively preload the first few for snappy paint
          return (
            <figure
              key={`${im.url}-${i}`}
              className={`relative overflow-hidden rounded-xl bg-neutral-100 ${slotClass(
                i
              )}`}
            >
              <Image
                src={im.url}
                alt={im.alt}
                fill
                sizes="(max-width: 768px) 50vw, 420px"
                className="object-cover"
                loading={eager ? "eager" : "lazy"}
                // leave decoding as auto; next/image optimizes
              />
            </figure>
          );
        })}
      </div>

      {/* subtle loading hint */}
      {loading && items.length === 0 && (
        <div className="text-xs text-neutral-500 mt-2">Loading photos…</div>
      )}
    </aside>
  );
}
