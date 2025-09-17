"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";

type CommonsImage = {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
  license?: string;
};

type Props = {
  /** If you already have explicit phrases (e.g., ["San Diego skyline", "Balboa Park"]) */
  list?: string[];
  /** A free-form sentence/paragraph like a micro-itinerary. We'll mine place names from it. */
  query?: string;
  /** Optional city name to prefix phrases for higher recall on Commons (e.g., "San Diego") */
  city?: string;
  /** Max images to render (default 10) */
  count?: number;
  /** Optional heading shown above the collage */
  title?: string;
  /** Optional footnote under the collage */
  attributionNote?: string;
  /** Compact mode (smaller thumbs) */
  compact?: boolean;
};

/** Minimal stopwords so we don't glue in noise when building phrases */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "at",
  "in",
  "on",
  "to",
  "from",
  "for",
  "with",
  "by",
  "near",
  "into",
  "onto",
  "through",
  "over",
  "under",
  "about",
  "after",
  "before",
  "during",
  "without",
  "between",
  "within",
]);

/**
 * Extract capitalized phrases like “Balboa Park”, “La Jolla Cove”, “Gaslamp Quarter”
 * from free-form text. Returns 1–4 word spans that *look* like place names.
 */
function extractCapitalizedPhrases(text: string): string[] {
  if (!text) return [];
  // Split sentences so we don’t bleed across punctuation
  const chunks = text.split(/[\.\!\?;\n]+/).map((s) => s.trim()).filter(Boolean);

  const phrases = new Set<string>();

  for (const chunk of chunks) {
    // Tokenize words (keep apostrophes and hyphens in names)
    const words = chunk.match(/[A-Za-z][A-Za-z'\-]*/g) || [];
    let run: string[] = [];

    const flushRun = () => {
      if (run.length === 0) return;
      // A valid place-ish phrase is 1–5 tokens and not all stopwords
      const allStop = run.every((w) => STOPWORDS.has(w.toLowerCase()));
      if (!allStop && run.length <= 5) {
        phrases.add(run.join(" "));
      }
      run = [];
    };

    for (const w of words) {
      const isCaps =
        /^[A-Z]/.test(w) || // starts uppercase
        /^[A-Z][a-z]+$/.test(w) || // e.g., “Balboa”
        /^[A-Z][a-z]+('[A-Z][a-z]+)?$/.test(w); // O'Something
      if (isCaps && !STOPWORDS.has(w.toLowerCase())) {
        run.push(w);
      } else {
        flushRun();
      }
    }
    flushRun();
  }

  // Keep only 1–4 word spans (avoid entire sentence starts)
  const cleaned = Array.from(phrases)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const wc = p.split(/\s+/).length;
      return wc >= 1 && wc <= 4;
    });

  // Deduplicate case-insensitively
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of cleaned) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(p);
    }
  }
  return unique;
}

/** Turn a `query` string (narrative) into short Commons queries, prefixed with city when present */
function deriveQueriesFromQuery(query: string, city?: string, max = 12): string[] {
  const phrases = extractCapitalizedPhrases(query);
  const scoped = phrases.map((p) => (city ? `${city} ${p}` : p));

  // Add a few generic city fallbacks so you always get something
  const gen = city
    ? [
        `${city} skyline`,
        `${city} downtown`,
        `${city} landmarks`,
        `${city} street art`,
        `${city} festival`,
        `${city} market`,
        `${city} nightlife`,
      ]
    : [];

  // Unique and cap
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...scoped, ...gen]) {
    const k = s.trim().toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(s.trim());
      if (out.length >= max) break;
    }
  }
  return out;
}

async function commonsFetch(term: string, count: number): Promise<CommonsImage[]> {
  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: term, count }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({ images: [] }));
  return Array.isArray(data?.images) ? (data.images as CommonsImage[]) : [];
}

async function logClient(payload: any) {
  try {
    await fetch("/api/client-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
}

export default function LivePhotoPane({
  list,
  query,
  city,
  count = 10,
  title,
  attributionNote,
  compact,
}: Props) {
  const [images, setImages] = React.useState<CommonsImage[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);

      // 1) Build the search terms
      let terms: string[] = [];
      if (Array.isArray(list) && list.length) {
        terms = list
          .map((s) => String(s || ""))
          .filter(Boolean)
          .map((s) => (city ? `${city} ${s}` : s));
      } else if (query) {
        terms = deriveQueriesFromQuery(query, city, Math.max(count * 2, 12));
      }

      // Ensure we have something
      if (!terms.length && city) {
        terms = deriveQueriesFromQuery("", city, Math.max(count * 2, 12));
      }

      // 2) Fetch images term-by-term until we fill `count`
      const picked: CommonsImage[] = [];
      const tried: { term: string; got: number }[] = [];

      for (const t of terms) {
        if (picked.length >= count) break;
        const remain = Math.min(6, count - picked.length); // pull a few per term
        const got = await commonsFetch(t, remain);
        tried.push({ term: t, got: got.length });

        for (const im of got) {
          // Deduplicate by URL
          if (!picked.find((x) => x.url === im.url)) {
            picked.push(im);
            if (picked.length >= count) break;
          }
        }
      }

      // 3) Log everything to Vercel
      await logClient({
        tag: "images",
        city,
        countRequested: count,
        strategy: list?.length ? "explicit-list" : "extracted-from-query",
        termsTried: tried,
        returned: picked.map((p) => ({ url: p.url, title: p.title, license: p.license })),
      });

      if (!cancelled) {
        setImages(picked);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(list), query, city, count]);

  const grid = compact
    ? "grid grid-cols-3 gap-2"
    : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3";

  return (
    <div className="rounded-xl border bg-white/60 p-3 md:p-4">
      {title ? <h3 className="text-sm font-semibold mb-2">{title}</h3> : null}
      <div className={grid}>
        {loading &&
          Array.from({ length: count }).map((_, i) => (
            <div
              key={`ph-${i}`}
              className="aspect-[4/3] animate-pulse rounded-lg bg-neutral-200"
            />
          ))}
        {!loading &&
          images.map((im, i) => (
            <a
              key={im.url + i}
              href={im.source || im.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
              title={im.title || ""}
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-white">
                <img
                  src={im.url}
                  alt={im.title || "Photo"}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              {im.title ? (
                <div className="mt-1 text-[11px] text-neutral-600 line-clamp-1">
                  {im.title.replace(/^File:/i, "")}
                </div>
              ) : null}
            </a>
          ))}
        {!loading && images.length === 0 && (
          <div className="text-sm text-neutral-500">No images found.</div>
        )}
      </div>
      {attributionNote ? (
        <div className="mt-2 text-[11px] text-neutral-500">{attributionNote}</div>
      ) : null}
    </div>
  );
}
