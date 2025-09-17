// components/LivePhotoPane.tsx
"use client";

import React from "react";

type Img = {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
  license?: string;
};

type Props = {
  /** Single search string, e.g. "Austin skyline Zilker Park live music". */
  query: string;
  /** How many images to try to show. */
  count?: number;
  /** Optional title at the top of this pane. */
  title?: string;
  /** Small note shown at the bottom (e.g., attribution). */
  attributionNote?: string;
};

export default function LivePhotoPane({
  query,
  count = 10,
  title,
  attributionNote = "Photos via Wikimedia Commons",
}: Props) {
  const [imgs, setImgs] = React.useState<Img[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const reqId = Math.random().toString(36).slice(2, 8);
      try {
        setLoading(true);
        setErr(null);
        setImgs(null);
        console.log(`[live-pane ${reqId}] fetch start:`, { query, count });
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ q: query, count }),
          cache: "no-store",
        });
        if (!res.ok) {
          const t = await res.text();
          console.log(`[live-pane ${reqId}] error status=${res.status} body=${t}`);
          throw new Error(`images ${res.status}`);
        }
        const json = await res.json();
        if (cancelled) return;
        setImgs(Array.isArray(json.images) ? json.images : []);
        console.log(`[live-pane ${reqId}] ok images=${json.images?.length ?? 0}`);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (query && query.trim()) run();
    return () => {
      cancelled = true;
    };
  }, [query, count]);

  return (
    <div className="rounded-xl border bg-white/50 p-2 h-[360px] overflow-hidden flex flex-col">
      {title ? (
        <div className="text-sm font-medium text-neutral-700 px-1 pb-1">
          {title}
        </div>
      ) : null}

      <div className="relative flex-1 overflow-auto">
        {!imgs && !err && loading && (
          <div className="h-full grid place-items-center text-sm text-neutral-500">
            Loading images…
          </div>
        )}

        {err && (
          <div className="h-full grid place-items-center text-sm text-rose-600">
            {err}
          </div>
        )}

        {imgs && imgs.length === 0 && (
          <div className="h-full grid place-items-center text-sm text-neutral-500">
            No live images found.
          </div>
        )}

        {imgs && imgs.length > 0 && (
          <div className="columns-2 gap-2 [column-fill:_balance]">
            {imgs.map((im, i) => (
              <a
                key={`${im.url}-${i}`}
                href={im.source || im.url}
                target="_blank"
                rel="noreferrer"
                className="break-inside-avoid block mb-2"
                title={im.title || undefined}
              >
                {/* using native img keeps it simple and works cross-origin */}
                <img
                  src={im.url}
                  alt={im.title || "photo"}
                  className="w-full rounded-lg border bg-white/40 object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="pt-1 text-[11px] text-neutral-500 px-1">
        {attributionNote}
      </div>
    </div>
  );
}
