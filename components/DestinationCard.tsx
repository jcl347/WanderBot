// components/DestinationCard.tsx
"use client";
import Link from "next/link";
import React from "react";
import { prewarmImages, buildSimpleTermsFromDest } from "@/lib/image-prewarm";

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

  // Build the same short "<city> <keyword>" terms the detail page will use.
  const terms = React.useMemo(() => buildSimpleTermsFromDest(dest, 16), [dest]);
  const prewarmNow = React.useCallback(() => {
    if (terms.length) prewarmImages(terms, 16).catch(() => {});
  }, [terms.join("|")]);

  // Prewarm when the card is near the viewport (smooth scroll hoverless devices)
  const ref = React.useRef<HTMLAnchorElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !terms.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            prewarmNow();
            io.disconnect();
          }
        });
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [terms, prewarmNow]);

  return (
    <Link
      ref={ref}
      href={href}
      className="block rounded-2xl border bg-gradient-to-br from-white to-sky-50/60 p-4 shadow-sm hover:shadow-md transition-shadow"
      onMouseEnter={prewarmNow}
      onFocus={prewarmNow}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-sky-100 grid place-items-center text-sky-700">
          🧭
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sky-900">{dest.name}</div>
          <p className="mt-1 text-sm text-neutral-700 line-clamp-3">
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
      </div>
    </Link>
  );
}
