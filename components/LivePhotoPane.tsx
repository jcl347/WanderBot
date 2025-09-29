// components/LivePhotoPane.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import NextImage from "next/image"; // alias to avoid shadowing window.Image

type Img = { url: string; title?: string; source?: string; license?: string };

type Props = {
  // EITHER `query` OR `terms`; if `query` given we split by comma into simple terms.
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

  const simpleTerms = useMemo(() => toTerms(query, terms).slice(0, 8), [query, terms]);
  const termsKey = useMemo(() => simpleTerms.join("|"), [simpleTerms]);

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
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { images: Img[] };
        const imgs = Array.isArray(json?.images) ? json.images.slice(0, count) : [];

        // Preload to avoid popping (guard for SSR)
        if (typeof window !== "undefined") {
          imgs.forEach((im) => {
            try {
              const pre = new window.Image();
              pre.src = im.url;
            } catch {
              /* noop */
            }
          });
        }

        if (!cancelled) setImages(imgs);
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
    // keep deps simple; eslint wants actual vars, not complex expressions
  }, [count, termsKey]);

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
          style={{ gridAutoRows: "90px" }}
        >
          {images.map((im, i) => (
            <div
              key={`${im.url}-${i}`}
              className={`relative rounded-xl overflow-hidden shadow-sm ${i % 7 === 0 ? "row-span-2" : ""}`}
            >
              <NextImage
                src={im.url}
                alt={im.title || "Photo"}
                fill
                sizes="(max-width: 768px) 33vw, 360px"
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
