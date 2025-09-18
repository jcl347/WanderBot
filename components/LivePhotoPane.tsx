"use client";

import React from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source?: string; license?: string };

type Props = {
  /** Prefer this simple shape: city + short terms (e.g., ["South Beach","Wynwood","Art Deco"]) */
  city?: string;
  terms?: string[];
  /** Or pass a single short query like "Miami South Beach" */
  query?: string;

  /** Total images to render */
  count?: number;

  /** Cosmetic: which rail this pane lives in */
  orientation?: "left" | "right";

  /** Extra classes for outer wrapper */
  className?: string;

  /** Mark first n images as priority to preload for better LCP when opening the card */
  priorityFirst?: number;
};

function cx(...a: Array<string | false | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function LivePhotoPane({
  city,
  terms,
  query,
  count = 12,
  orientation = "left",
  className = "",
  priorityFirst = 4,
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // Build the payload the /api/images route expects
  const payload = React.useMemo(() => {
    if (query && query.trim()) return { q: query.trim(), count };
    const cleanTerms =
      Array.isArray(terms) && terms.length
        ? terms.filter((t) => typeof t === "string" && t.trim())
        : [];
    return { city: (city || "").trim(), terms: cleanTerms, count };
  }, [city, terms, query, count]);

  // Fetch & preload
  React.useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { images?: Img[] };
        const imgs = Array.isArray(json.images) ? json.images : [];
        // Preload via Image() objects (non-blocking)
        imgs.slice(0, priorityFirst).forEach((im) => {
          if (!im?.url) return;
          const i = new window.Image();
          i.src = im.url;
        });
        setImages(imgs);
      } catch (e: any) {
        setErr(e?.message || "Failed to load images");
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload)]);

  // Masonry-ish layout using CSS grid with variable row spans.
  // We mix sizes for a collage feel and let Next/Image handle object-fit cover.
  const slots = React.useMemo(() => {
    const sizes = [
      "row-span-2 h-56",
      "row-span-3 h-80",
      "row-span-2 h-52",
      "row-span-1 h-36",
      "row-span-2 h-60",
      "row-span-1 h-40",
    ];
    return (images.length ? images : new Array(count).fill(null)).map((_, i) => sizes[i % sizes.length]);
  }, [images, count]);

  return (
    <div
      className={cx(
        "rounded-2xl border bg-white/70 p-2 md:p-3",
        orientation === "left" ? "md:sticky md:top-6" : "md:sticky md:top-6",
        className
      )}
    >
      <div
        className={cx(
          // 2 cols on small, 3 on md+. Dense rows to create collage look
          "grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 auto-rows-[8px]"
        )}
      >
        {loading &&
          new Array(Math.max(6, count / 2 | 0)).fill(0).map((_, i) => (
            <div
              key={`sk-${i}`}
              className={cx(
                "animate-pulse rounded-xl bg-neutral-200/70",
                i % 3 === 0 ? "h-40" : i % 3 === 1 ? "h-56" : "h-32"
              )}
            />
          ))}

        {!loading &&
          images.map((im, i) => {
            const cls = cx(
              "relative overflow-hidden rounded-xl bg-neutral-100",
              slots[i] || "h-40"
            );
            const priority = i < priorityFirst;
            const alt =
              im?.title?.replace(/^File:/, "") ||
              im?.source?.split("/").slice(-1)[0] ||
              "Travel photo";
            return (
              <a
                key={im.url + i}
                className={cls}
                href={im.source || im.url}
                target="_blank"
                rel="noreferrer"
                title={alt}
              >
                <Image
                  src={im.url}
                  alt={alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  priority={priority}
                  loading={priority ? "eager" : "lazy"}
                  placeholder="empty"
                  style={{ objectFit: "cover" }}
                />
              </a>
            );
          })}

        {!loading && !images.length && (
          <div className="col-span-2 md:col-span-3 text-sm text-neutral-500 p-2">
            No images found for{" "}
            <code className="px-1 py-0.5 bg-neutral-100 rounded">
              {payload.q ?? `${payload.city} ${Array.isArray(payload.terms) ? payload.terms.join(", ") : ""}`}
            </code>
            .
          </div>
        )}
      </div>

      {/* Tiny license note (Commons images are typically CC or PD) */}
      {!!images.length && (
        <p className="mt-2 text-[11px] text-neutral-500">
          Images via Wikimedia Commons • Click a tile for source/attribution.
        </p>
      )}

      {err && (
        <p className="mt-2 text-xs text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
