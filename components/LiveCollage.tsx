// components/LiveCollage.tsx
"use client";
import React from "react";

type Img = { url: string; title?: string; source?: string };

// Small, safe shuffle
function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function stem(u: string) {
  try {
    const x = new URL(u);
    const p = x.pathname.split("/").pop() || "";
    return `${x.hostname}/${p.replace(/\.(jpg|jpeg|png|webp|gif|bmp|tiff).*$/i, "")}`.toLowerCase();
  } catch {
    return u;
  }
}

async function verifyUrl(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { range: "bytes=0-1023" },
      signal,
    });
    if (!r.ok) return false;
    const ct = r.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

async function fetchImages(query: string, want: number, signal: AbortSignal): Promise<Img[]> {
  const overshoot = Math.max(want * 3, want + 12); // over-fetch to allow for dead links
  const res = await fetch(
    `/api/images?q=${encodeURIComponent(query)}&count=${overshoot}`,
    { cache: "no-store", signal }
  );
  const j = (await res.json()) as { images: Img[] };
  return Array.isArray(j.images) ? j.images : [];
}

async function verifyMany(candidates: Img[], want: number, signal: AbortSignal): Promise<Img[]> {
  const out: Img[] = [];
  const dedup = new Set<string>();
  const queue = candidates.filter((c) => {
    const key = stem(c.url);
    if (dedup.has(key)) return false;
    dedup.add(key);
    return true;
  });

  // modest concurrency to be gentle on CDNs
  const CONCURRENCY = 4;
  let idx = 0;
  async function worker() {
    while (!signal.aborted && out.length < want && idx < queue.length) {
      const cand = queue[idx++];
      // eslint-disable-next-line no-await-in-loop
      const ok = await verifyUrl(cand.url, signal);
      if (ok) out.push(cand);
    }
  }
  const jobs = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.race([Promise.all(jobs), new Promise<void>((_, rej) => {
    signal.addEventListener("abort", () => rej(new Error("aborted")));
  })]).catch(() => { /* ignore on abort */ });

  return out.slice(0, want);
}

function Tile({ src, alt, span }: { src: string; alt?: string; span: "sm" | "md" | "lg" }) {
  const classFor = span === "lg"
    ? "col-span-2 row-span-2"
    : span === "md"
    ? "col-span-2 row-span-1"
    : "col-span-1 row-span-1";

  return (
    <div className={`rounded-xl overflow-hidden border bg-white/60 ${classFor}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
      />
    </div>
  );
}

/**
 * LiveCollage fetches from two queries, verifies links, fills left/right evenly,
 * and renders a tasteful mosaic.
 */
export default function LiveCollage({
  leftQuery,
  rightQuery,
  leftCount = 8,
  rightCount = 8,
  leftTitle = "Vibe check",
  rightTitle = "More views",
}: {
  leftQuery: string;
  rightQuery: string;
  leftCount?: number;
  rightCount?: number;
  leftTitle?: string;
  rightTitle?: string;
}) {
  const [leftImgs, setLeftImgs] = React.useState<Img[] | null>(null);
  const [rightImgs, setRightImgs] = React.useState<Img[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        // fetch in parallel
        const [Lraw, Rraw] = await Promise.all([
          fetchImages(leftQuery, leftCount, ctrl.signal),
          fetchImages(rightQuery, rightCount, ctrl.signal),
        ]);

        // shuffle before verify so we get variation
        shuffle(Lraw);
        shuffle(Rraw);

        const [Lok, Rok] = await Promise.all([
          verifyMany(Lraw, leftCount, ctrl.signal),
          verifyMany(Rraw, rightCount, ctrl.signal),
        ]);

        // If one side is short, borrow from the other’s remainder
        const Lneed = Math.max(0, leftCount - Lok.length);
        const Rneed = Math.max(0, rightCount - Rok.length);

        // pull extra (unverified) from the opposite raw lists and verify only what we need
        if (Lneed > 0) {
          const extras = Rraw.filter(
            (x) => !Rok.some((y) => stem(y.url) === stem(x.url))
          );
          const verified = await verifyMany(extras, Lneed, ctrl.signal);
          Lok.push(...verified);
        }
        if (Rneed > 0) {
          const extras = Lraw.filter(
            (x) => !Lok.some((y) => stem(y.url) === stem(x.url))
          );
          const verified = await verifyMany(extras, Rneed, ctrl.signal);
          Rok.push(...verified);
        }

        setLeftImgs(Lok.slice(0, leftCount));
        setRightImgs(Rok.slice(0, rightCount));
      } catch {
        setLeftImgs([]);
        setRightImgs([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [leftQuery, rightQuery, leftCount, rightCount]);

  const Skeleton = (
    <div className="text-sm text-neutral-500">Finding photos…</div>
  );

  const Grid = (items: Img[]) => {
    // pleasant pattern: lg sprinkled, a few md, many sm
    const pattern: Array<"sm" | "md" | "lg"> = ["lg", "sm", "md", "sm", "sm", "md", "sm", "sm"];
    return (
      <div
        className="
          grid grid-cols-2 auto-rows-[120px] gap-2
          [@media(min-width:1280px)]:auto-rows-[140px]
        "
      >
        {items.map((img, i) => (
          <Tile key={`${i}-${img.url}`} src={img.url} alt={img.title} span={pattern[i % pattern.length]} />
        ))}
      </div>
    );
  };

  return (
    <div className="hidden md:grid md:grid-cols-[320px_1fr_320px] md:gap-4">
      {/* LEFT */}
      <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:overflow-auto">
        <div className="rounded-2xl border bg-white/60 p-3 shadow-sm">
          <div className="text-lg font-semibold mb-2">{leftTitle}</div>
          {loading ? Skeleton : (leftImgs && leftImgs.length ? Grid(leftImgs) : <div className="text-sm text-neutral-500">No live images found.</div>)}
        </div>
      </aside>

      {/* MIDDLE – caller supplies content here via children */}
      <div className="px-0">
        {/* children injected by parent */}
      </div>

      {/* RIGHT */}
      <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:overflow-auto">
        <div className="rounded-2xl border bg-white/60 p-3 shadow-sm">
          <div className="text-lg font-semibold mb-2">{rightTitle}</div>
          {loading ? Skeleton : (rightImgs && rightImgs.length ? Grid(rightImgs) : <div className="text-sm text-neutral-500">No live images found.</div>)}
        </div>
      </aside>
    </div>
  );
}
