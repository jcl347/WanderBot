// components/LivePhotoPane.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Img = { url: string; title?: string; source?: string; license?: string };

type Props = {
  /** Plain phrase like "Miami South Beach" OR a city (use with `terms`) */
  query?: string;
  city?: string;
  terms?: string[]; // short 1–2 word phrases (e.g., ["South Beach","Wynwood"])
  count?: number;
  className?: string;
  orientation?: "left" | "right";
};

function buildQueryList(city: string, terms: string[], single?: string) {
  if (single && single.trim()) return [single.trim()];
  const c = (city || "").trim();
  const clean = (terms || [])
    .map((t) => String(t || "").replace(/[|,]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // Make simple "<city> <term>" phrases; keep it short so Commons returns hits
  return clean.map((t) => (c ? `${c} ${t}` : t));
}

export default function LivePhotoPane({
  query,
  city = "",
  terms = [],
  count = 12,
  className = "",
  orientation = "left",
}: Props) {
  const [images, setImages] = useState<Img[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "err">(
    "idle"
  );

  const queries = useMemo(() => buildQueryList(city, terms, query), [city, terms, query]);

  useEffect(() => {
    if (!queries.length) {
      setImages([]);
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        setStatus("loading");
        // Ask our images API once per rail by joining simple terms with spaces.
        // The API itself will do Commons lookups and verification.
        const q = queries.join(" ");
        const res = await fetch("/api/images", {
          method: "POST",
          signal: ac.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ q, count }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`images ${res.status}`);
        const json = await res.json();
        setImages(Array.isArray(json?.images) ? json.images : []);
        setStatus("done");
      } catch (e) {
        if (!ac.signal.aborted) {
          console.error("[LivePhotoPane] fetch error", e);
          setStatus("err");
        }
      }
    })();
    return () => ac.abort();
  }, [queries, count]);

  // Preload first few for snappier display when opening the page
  const preload = images.slice(0, Math.min(images.length, 6));

  return (
    <div
      className={[
        "relative grid grid-cols-3 gap-2",
        orientation === "left" ? "justify-start" : "justify-end",
        className,
      ].join(" ")}
    >
      {/* Invisible high-priority preloads */}
      <div className="sr-only">
        {preload.map((im, i) => (
          <Image
            key={`pre-${i}`}
            src={im.url}
            alt={im.title || "photo"}
            width={10}
            height={10}
            priority
          />
        ))}
      </div>

      {status === "loading" && (
        <div className="col-span-3 text-xs text-neutral-500 rounded-lg border p-2">
          Loading images…
        </div>
      )}

      {status !== "loading" && images.length === 0 && (
        <div className="col-span-3 text-xs text-neutral-500 rounded-lg border p-2">
          No images found.
        </div>
      )}

      {images.map((im, i) => (
        <div
          key={i}
          className="aspect-[4/5] overflow-hidden rounded-xl bg-neutral-200/50"
        >
          <Image
            src={im.url}
            alt={im.title || "photo"}
            width={600}
            height={750}
            className="h-full w-full object-cover"
            loading={i < 6 ? "eager" : "lazy"}
          />
        </div>
      ))}
    </div>
  );
}
