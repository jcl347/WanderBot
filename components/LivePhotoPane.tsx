// components/LivePhotoPane.tsx
"use client";

import * as React from "react";
import NextImage from "next/image";

type Img = { url: string; title?: string; source?: string; license?: string };

type Props = {
  terms: string[];    // required – short "<city> <keyword>" phrases
  count?: number;     // total images target
  side?: "left" | "right" | "bottom";
  className?: string;
};

export default function LivePhotoPane({
  terms,
  count = 12,
  side = "left",
  className = "",
}: Props) {
  const [images, setImages] = React.useState<Img[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const termsKey = React.useMemo(() => terms.join("|"), [terms]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!terms.length) {
        setImages([]);
        return;
      }

      try {
        setLoading(true);
        setErrorText(null);

        const body = { terms, count: Math.max(8, Math.min(24, count * 2)) };
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

        // Preload aggressively
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
  }, [count, termsKey]);

  return (
    <div
      className={[
        "rounded-xl border bg-white/70 p-2 md:p-3 shadow-sm",
        side === "left" ? "mr-2" : side === "right" ? "ml-2" : "mt-3",
        className,
      ].join(" ")}
    >
      {errorText ? (
        <div className="text-xs text-neutral-500">
          No images found for: {terms.join(", ")}
        </div>
      ) : loading && images.length === 0 ? (
        <div className="text-xs text-neutral-500">
          Loading images for {terms.join(" · ")}…
        </div>
      ) : (
        <div
          className="
            grid gap-3
            grid-cols-2
            sm:grid-cols-3
            lg:grid-cols-2
            xl:grid-cols-3
            2xl:grid-cols-3
          "
        >
          {images.map((img, i) => {
            const tall = i % 6 === 0;
            const wide = i % 5 === 0 && !tall;
            const baseCls =
              "relative rounded-xl overflow-hidden bg-neutral-100 shadow";

            const boxCls = tall
              ? `${baseCls} row-span-2 h-[420px]`
              : wide
              ? `${baseCls} col-span-2 h-[280px]`
              : `${baseCls} h-[220px]`;

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
