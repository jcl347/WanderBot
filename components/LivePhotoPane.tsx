"use client";

import React from "react";

type Props = {
  query: string;
  count?: number;
  title?: string;
  attributionNote?: string;
  /** Optional – accepted but unused, so callers passing it won't break types */
  orientation?: "left" | "right";
};

type ImageItem = {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
};

export default function LivePhotoPane({
  query,
  count = 10,
  title,
  attributionNote = "Images from DuckDuckGo/Wikimedia (hotlink-safe where available).",
}: Props) {
  const [items, setItems] = React.useState<ImageItem[] | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );

  React.useEffect(() => {
    let dead = false;

    async function run() {
      try {
        setState("loading");
        // Client log → server (so you see it in Vercel)
        try {
          await fetch("/api/client-log", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              scope: "images:request",
              q: query,
              count,
            }),
          });
        } catch {}

        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ q: query, count }),
        });

        if (!res.ok) {
          setState("error");
          // Log failure
          try {
            await fetch("/api/client-log", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                scope: "images:error",
                status: res.status,
                q: query,
              }),
            });
          } catch {}
          return;
        }

        const data = await res.json();
        if (dead) return;

        const list: ImageItem[] = Array.isArray(data?.images) ? data.images : [];
        setItems(list);
        setState("done");

        // success log with counts
        try {
          await fetch("/api/client-log", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              scope: "images:response",
              q: query,
              requested: count,
              returned: list.length,
            }),
          });
        } catch {}
      } catch (e) {
        setState("error");
      }
    }

    if (query && query.trim()) run();
    return () => {
      dead = true;
    };
  }, [query, count]);

  const empty = state === "done" && (!items || items.length === 0);

  return (
    <div className="rounded-xl border bg-white/50">
      {title ? (
        <div className="px-3 py-2 border-b font-medium text-sm">{title}</div>
      ) : null}

      {/* content area */}
      <div className="p-2">
        {state === "loading" ? (
          <div className="text-sm text-neutral-500 p-2">Loading images…</div>
        ) : empty ? (
          <div className="text-sm text-neutral-500 p-2">No live images found.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {(items || []).slice(0, count).map((img, i) => (
              <div
                key={i}
                className="aspect-[4/3] overflow-hidden rounded-lg border bg-white/60"
                title={img.title || ""}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.title || "photo"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 pb-2 text-[11px] text-neutral-500">
        {attributionNote}
      </div>
    </div>
  );
}
