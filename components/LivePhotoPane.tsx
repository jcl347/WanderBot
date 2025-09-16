// components/LivePhotoPane.tsx
"use client";
import React from "react";

type Img = { url: string; title?: string; source?: string };

async function verifyUrl(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    // HEAD often gets blocked; tiny GET with range is more reliable
    const r = await fetch(url, {
      method: "GET",
      headers: { range: "bytes=0-0" },
      signal,
    });
    const ct = r.headers.get("content-type") || "";
    return r.ok && ct.includes("image");
  } catch {
    return false;
  }
}

export default function LivePhotoPane({
  query,
  count = 6,
  title,
  attributionNote,
}: {
  query: string;
  count?: number;
  title?: string;
  attributionNote?: string;
}) {
  const [imgs, setImgs] = React.useState<Img[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/images?q=${encodeURIComponent(query)}&count=${count}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const j = (await r.json()) as { images: Img[] };
        const candidates = Array.isArray(j.images) ? j.images : [];

        // Verify in small batches to avoid hammering
        const verified: Img[] = [];
        for (const cand of candidates) {
          if (verified.length >= count) break;
          // eslint-disable-next-line no-await-in-loop
          const ok = await verifyUrl(cand.url, ctrl.signal);
          if (ok) verified.push(cand);
        }
        setImgs(verified);
      } catch (e) {
        setImgs([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [query, count]);

  return (
    <div className="space-y-2">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}

      {loading && <div className="text-sm text-neutral-500">Finding photos…</div>}

      {!loading && imgs.length === 0 && (
        <div className="text-sm text-neutral-500">No live images found.</div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {imgs.map((img, i) => (
          <div key={`${i}-${img.url}`} className="aspect-[4/3] overflow-hidden rounded-xl border bg-white/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.title || ""}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
            />
          </div>
        ))}
      </div>

      {attributionNote && (
        <p className="mt-2 text-xs text-neutral-500">{attributionNote}</p>
      )}
    </div>
  );
}
