"use client";

import * as React from "react";
import NextImage from "next/image";

type Img = { url: string; title?: string; source?: string; license?: string };

type Props = {
  query?: string;
  terms?: string[];
  count?: number;
  orientation?: "left" | "right";
  className?: string;
};

function firstToken(s: string): string {
  const parts = String(s || "").split(/[,(|-]/);
  return (parts[0] || s || "").trim();
}

function buildSimpleTerms(query?: string, terms?: string[], want = 10): string[] {
  const city = firstToken(String(query || "").trim());
  const fromProps = (terms || []).filter(Boolean);

  if (!city && !fromProps.length) return [];

  if (fromProps.length) {
    return Array.from(
      new Set(
        fromProps
          .map((t) => String(t).trim())
          .filter(Boolean)
          .map((t) => {
            const one = t.replace(/\s+/g, " ").trim();
            if (city && one.toLowerCase().startsWith(city.toLowerCase() + " ")) return one;
            return city ? `${city} ${one}` : one;
          })
      )
    ).slice(0, want);
  }

  const defaults = [
    "skyline",
    "downtown",
    "beach",
    "harbor",
    "park",
    "museum",
    "nightlife",
    "market",
    "street",
    "festival",
    "landmarks",
  ];

  const out = defaults.map((k) => (query ? `${city} ${k}` : k));
  return Array.from(new Set(out)).slice(0, want);
}

export default function LivePhotoPane({
  query,
  terms,
  count = 10,
  orientation = "left",
  className = "",
}: Props) {
  const simpleTerms = React.useMemo(() => buildSimpleTerms(query, terms, count * 2), [query, terms, count]);

  const [images, setImages] = React.useState<Img[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const termsKey = React.useMemo(() => simpleTerms.join("|"), [simpleTerms]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!simpleTerms.length) {
        setImages([]);
        return;
      }

      try {
        setLoading(true);
        setErrorText(null);

        const body = { q: simpleTerms.join(", "), count: Math.max(8, Math.min(24, count * 2)) };
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`images api ${res.status}`);
        const json = await res.json();

        const imgs: Img[] = Array.isArray(json?.images)
          ? (json.images as Img[]).filter((x) => typeof x?.url === "string")
          : [];

        if (cancelled) return;

        // Preload
        if (typeof window !== "undefined") {
          imgs.slice(0, count).forEach((im) => {
            const i = new (window as any).Image() as HTMLImageElement;
            i.decoding = "async";
            i.loading = "eager";
            i.src = im.url;
          });
        }

        setImages(imgs.slice(0, count));
      } catch (e: any) {
        if (!cancelled) {
          setErrorText(e?.message || "Failed to load images");
          setImages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [count, termsKey, simpleTerms]);

  return (
    <div
      className={[
        "rounded-xl border bg-white/60 p-2 md:p-3",
        orientation === "left" ? "mr-2" : "ml-2",
        className,
      ].join(" ")}
    >
      {errorText ? (
        <div className="text-xs text-neutral-500">No images found for: {simpleTerms.join(", ")}</div>
      ) : loading && images.length === 0 ? (
        <div className="text-xs text-neutral-500">Loading images for {simpleTerms.join(" · ")}…</div>
      ) : (
        <div
          className="
            grid gap-2
            grid-cols-2
            sm:grid-cols-3
            lg:grid-cols-2
            xl:grid-cols-3
            2xl:grid-cols-3
          "
        >
          {images.map((img, i) => {
            const tall = i % 7 === 0;
            const wide = i % 5 === 0 && !tall;
            const baseCls = "relative rounded-xl overflow-hidden bg-neutral-100";

            const boxCls = tall
              ? `${baseCls} row-span-2 h-[340px]`
              : wide
              ? `${baseCls} col-span-2 h-[220px]`
              : `${baseCls} h-[160px]`;

            return (
              <div key={`${img.url}-${i}`} className={boxCls}>
                <NextImage
                  src={img.url}
                  alt={img.title || "travel photo"}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 33vw"
                  className="object-cover"
                  priority={i < 6}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
