"use client";

import * as React from "react";
import Image from "next/image";
import clsx from "clsx";
import LivePhotoPane from "./LivePhotoPane";

/**
 * Three-column wrapper with left/right rails and an optional
 * horizontal collage strip above and below the middle content.
 */
export default function LiveCollage({
  leftTerms = [],
  rightTerms = [],
  centerTerms,
  railWidth = 420,
  children,
  className = "",
  railClassName = "",
  middleClassName = "",
}: {
  leftTerms?: string[];
  rightTerms?: string[];
  /** Optional terms for the horizontal collage above/below the content */
  centerTerms?: string[];
  railWidth?: number;
  children: React.ReactNode;
  className?: string;
  railClassName?: string;
  middleClassName?: string;
}) {
  const mergedBottom = React.useMemo(() => {
    const b = centerTerms && centerTerms.length ? centerTerms : [...leftTerms, ...rightTerms];
    return Array.from(new Set(b)).slice(0, 18);
  }, [centerTerms, leftTerms, rightTerms]);

  return (
    <div className={className}>
      {/* Mobile: content first, then a fat collage */}
      <div className="md:hidden space-y-4">
        <div>{children}</div>
        {mergedBottom.length > 0 && (
          <HeroStrip terms={mergedBottom} className="mt-2" />
        )}
      </div>

      {/* Desktop: roomy 3-col grid with sticky rails */}
      <div
        className={clsx(
          "hidden md:grid gap-6 xl:gap-8",
          "lg:grid-cols-[360px_minmax(0,1fr)_360px]",
          "xl:grid-cols-[420px_minmax(0,1fr)_420px]",
          "2xl:grid-cols-[480px_minmax(0,1fr)_480px]"
        )}
        style={{ gridTemplateColumns: `${railWidth}px minmax(0,1fr) ${railWidth}px` }}
      >
        {/* LEFT RAIL */}
        <div className="sticky top-20 self-start w-full">
          {leftTerms.length > 0 && (
            <LivePhotoPane terms={leftTerms} count={18} className={clsx("w-full", railClassName)} />
          )}
        </div>

        {/* MIDDLE – with horizontal strips above and below */}
        <div className={clsx("space-y-6", middleClassName)}>
          {mergedBottom.length > 0 && <HeroStrip terms={mergedBottom} />}
          <div>{children}</div>
          {mergedBottom.length > 0 && <HeroStrip terms={mergedBottom} />}
        </div>

        {/* RIGHT RAIL */}
        <div className="sticky top-20 self-start w-full">
          {rightTerms.length > 0 && (
            <LivePhotoPane terms={rightTerms} count={18} className={clsx("w-full", railClassName)} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Simple horizontal collage strip that preloads a handful of images */
function HeroStrip({ terms, className = "" }: { terms: string[]; className?: string }) {
  const [imgs, setImgs] = React.useState<{ src: string; title?: string | null }[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const qs = new URLSearchParams();
        terms.slice(0, 12).forEach((t) => qs.append("terms", t));
        qs.set("count", "14");
        const res = await fetch(`/api/images?${qs.toString()}`);
        const data = await res.json();
        if (cancelled) return;

        const list: { src: string; title?: string | null }[] = Array.isArray(data?.images)
          ? data.images.filter((x: any) => x?.src).map((x: any) => ({ src: x.src, title: x.title || null }))
          : [];
        setImgs(list.slice(0, 14));

        // Preconnect + eager preload a few
        if (typeof document !== "undefined") {
          const pc = document.createElement("link");
          pc.rel = "preconnect";
          pc.href = "https://upload.wikimedia.org";
          document.head.appendChild(pc);

          for (const i of list.slice(0, 6)) {
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "image";
            link.href = i.src;
            document.head.appendChild(link);
          }
        }
      } catch (e) {
        console.warn("[HeroStrip] image fetch failed", e);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [terms.join("\u0001")]);

  return (
    <div
      className={clsx(
        "rounded-2xl border bg-white/70 backdrop-blur",
        "overflow-x-auto no-scrollbar",
        className
      )}
    >
      <div className="grid auto-cols-[180px] grid-flow-col gap-3 p-3">
        {imgs.map((im, i) => (
          <figure key={`${im.src}-${i}`} className="relative h-44 w-[180px] overflow-hidden rounded-xl border bg-white">
            <Image
              src={im.src}
              alt={im.title || "Vacation photo"}
              fill
              sizes="180px"
              className="object-cover"
              loading={i < 2 ? "eager" : "lazy"}
              priority={i < 2}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
