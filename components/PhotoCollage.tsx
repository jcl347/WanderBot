// components/PhotoCollage.tsx
"use client";

import React from "react";

/**
 * Only show LIVE images.
 * - Accepts up to ~8 candidates (usually 4 from the model)
 * - Filters to real Wikimedia image files (upload.wikimedia.org + jpg/png/jpeg)
 * - Preloads each image; only renders ones that actually load
 * - Shows subtle placeholders while checking; shows a note if none work
 */

type Props = {
  slug: string;        // unused here, but kept for parity with callers
  photos?: string[];   // candidate URLs from the model
};

const isLikelyWikimediaImage = (url: string) => {
  try {
    const u = new URL(url);
    const hostOK = u.hostname === "upload.wikimedia.org";
    const path = u.pathname.toLowerCase();
    const extOK = path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png");
    return hostOK && extOK;
  } catch {
    return false;
  }
};

const loadImage = (src: string, timeoutMs = 10000) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    let done = false;

    const clear = () => {
      img.onload = null;
      img.onerror = null;
    };

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        clear();
        reject(new Error("timeout"));
      }
    }, timeoutMs);

    img.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        clear();
        resolve(src);
      }
    };
    img.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        clear();
        reject(new Error("error"));
      }
    };

    // Some Wikimedia files require referrer policy to load correctly when hotlinking.
    // Setting it on the preloader has no effect, but we'll also set it on the <img /> we render.
    img.referrerPolicy = "no-referrer";
    img.crossOrigin = "anonymous";
    img.src = src;
  });

export default function PhotoCollage({ slug, photos }: Props) {
  const [valid, setValid] = React.useState<string[]>([]);
  const [checking, setChecking] = React.useState<boolean>(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setChecking(true);

      const candidates = (Array.isArray(photos) ? photos : [])
        .filter(Boolean)
        .map(String)
        .filter(isLikelyWikimediaImage)
        .slice(0, 8); // sanity cap

      if (candidates.length === 0) {
        if (!cancelled) {
          setValid([]);
          setChecking(false);
        }
        return;
      }

      // Try to load all candidates; keep the ones that resolve.
      const settled = await Promise.allSettled(candidates.map((u) => loadImage(u)));
      const ok = settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value)
        .slice(0, 4); // show at most 4

      if (!cancelled) {
        setValid(ok);
        setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, photos]);

  // Skeletons while checking
  if (checking) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] overflow-hidden rounded-xl border bg-white/60"
          >
            <div className="h-full w-full animate-pulse bg-neutral-200/60" />
          </div>
        ))}
      </div>
    );
  }

  if (valid.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        Photos aren’t available right now for this destination. (The links provided didn’t load.)
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {valid.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className="aspect-[4/3] overflow-hidden rounded-xl border bg-white/60"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
            onError={(e) => {
              // In the unlikely event a previously-loaded URL 404s later, hide the broken cell
              const el = e.currentTarget;
              el.style.display = "none";
            }}
          />
        </div>
      ))}
    </div>
  );
}
