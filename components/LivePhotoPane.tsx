// components/LivePhotoPane.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source?: string; license?: string };

type Props = {
  // EITHER `query` OR `terms`; if `query` given we split by comma to get simple terms.
  query?: string;
  terms?: string[];
  count?: number;
  orientation?: "left" | "right";
  className?: string;
};

function toTerms(query?: string, terms?: string[]) {
  if (Array.isArray(terms) && terms.length) {
    return terms.filter((s) => typeof s === "string" && s.trim());
  }
  const q = (query || "").trim();
  if (!q) return [];
  // split “Miami South Beach, Miami Wynwood” -> ["Miami South Beach", "Miami Wynwood"]
  return q
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function LivePhotoPane({
  query,
  terms,
  count = 14,
  orientation = "left",
  className = "",
}: Props) {
  const [images, setImages] = useState<Img[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const simpleTerms = useMemo(() => {
    const t = toTerms(query, terms);
    // hard-cap to keep each term simple
    return t.slice(0, 8);
  }, [query, terms]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr(null);
      setImages(null);

      if (!simpleTerms.length) {
        setImages([]);
        return;
      }

      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ terms: simpleTerms, count }),
          // ensure we don’t cache empty/error responses
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { images: Img[] };
        const imgs = Array.isArray(json?.images) ? json.images : [];

        // Preload to avoid popping
        imgs.slice(0, count).forEach((im) => {
          const i = new Image();
          i.src = im.url;
        });

        if (!cancelled) setImages(imgs.slice(0, count));
      } catch (e: any) {
        if (!cancelled) {
          console.error("[LivePhotoPane] error", e?.message || e);
          setErr("Couldn’t load images.");
          setImages([]);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [count, simpleTerms.join("|")]);

  const side =
    orientation === "left"
      ? "justify-start md:justify-end pr-0 md:pr-2"
      : "justify-start md:justify-start pl-0 md:pl-2";

  return (
    <div className={`relative w-full ${className}`}>
      {!images && (
        <div className="text-xs text-neutral-500 px-3 py-2 rounded-lg bg-white/60 border">
          Loading images for {simpleTerms.join(", ")}…
        </div>
      )}
      {images && images.length === 0 && (
        <div className="text-xs text-neutral-500 px-3 py-2 rounded-lg bg-white/60 border">
          {err ? err : `No images found for: ${simpleTerms.join(", ")}`}
        </div>
      )}
      {images && images.length > 0 && (
        <div
          className={`grid grid-cols-3 gap-2 md:gap-3 ${side}`}
          style={{
            // big, airy rails
            gridAutoRows: "90px",
          }}
        >
          {images.map((im, i) => (
            <div
              key={`${im.url}-${i}`}
              className={`relative rounded-xl overflow-hidden shadow-sm ${i % 7 === 0 ? "row-span-2" : ""}`}
            >
              <Image
                src={im.url}
                alt={im.title || "Photo"}
                fill
                sizes="(max-width: 768px) 33vw, 260px"
                style={{ objectFit: "cover" }}
                priority={i < 4}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
