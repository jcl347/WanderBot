// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

// ---- simple helpers ----
const HEAD_TIMEOUT_MS = 6000;
const MAX_PER_QUERY = 30;

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

async function headOk(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), HEAD_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: ctl.signal });
    clearTimeout(id);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

// ---- DuckDuckGo images (no API key). We obtain vqd and call i.js ----
async function ddgImages(query: string, count: number): Promise<string[]> {
  try {
    const home = await fetch(
      "https://duckduckgo.com/?q=" + encodeURIComponent(query),
      { headers: { "user-agent": "Mozilla/5.0" } }
    );
    const html = await home.text();
    const m = html.match(/vqd='([^']+)'/);
    if (!m) {
      console.log("[images:ddg] no vqd for query:", query);
      return [];
    }
    const vqd = m[1];
    const api = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(
      query
    )}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
    const r = await fetch(api, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) {
      console.log("[images:ddg] i.js bad status:", r.status, query);
      return [];
    }
    const j = await r.json();
    const urls: string[] = Array.isArray(j?.results)
      ? j.results
          .map((x: any) => x?.image || x?.thumbnail || x?.url)
          .filter((u: string) => typeof u === "string")
      : [];
    return urls.slice(0, count);
  } catch (err: any) {
    console.log("[images:ddg] error", err?.message || err);
    return [];
  }
}

// ---- Wikimedia Commons search (no key) ----
async function commonsImages(query: string, count: number): Promise<string[]> {
  try {
    const api =
      "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
      encodeURIComponent(query) +
      "&gsrlimit=" +
      Math.min(count, MAX_PER_QUERY) +
      "&prop=imageinfo&iiprop=url&format=json&origin=*";
    const r = await fetch(api, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return [];
    const j = await r.json();
    const pages = j?.query?.pages || {};
    const urls: string[] = Object.values(pages)
      .map((p: any) => p?.imageinfo?.[0]?.url)
      .filter((u: string) => typeof u === "string");
    return urls.slice(0, count);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const queries: string[] = Array.isArray(body?.queries)
      ? body.queries.filter(Boolean)
      : [];
    const count = Math.min(Number(body?.count ?? 20), MAX_PER_QUERY);

    if (queries.length === 0) {
      return NextResponse.json(
        { error: "Missing queries[]" },
        { status: 400 }
      );
    }

    console.log("[images:request] start", {
      queriesCount: queries.length,
      count,
    });

    // For each query: try DDG, else Commons
    const all: string[] = [];
    for (const q of queries) {
      const ddg = await ddgImages(q, count);
      const got = ddg.length ? ddg : await commonsImages(q, count);
      all.push(...got);
      console.log("[images:q]", q, { ddg: ddg.length, commons: got.length });
    }

    // Dedup and verify
    const unique = uniq(all).slice(0, 80); // cap before HEAD checks
    const verified: string[] = [];
    for (const u of unique) {
      if (verified.length >= queries.length * count) break;
      if (await headOk(u)) verified.push(u);
    }

    console.log("[images:response] done", {
      requested: queries.length * count,
      combined_raw: all.length,
      verified: verified.length,
      ms: Date.now() - t0,
    });

    return NextResponse.json({ images: verified });
  } catch (err: any) {
    console.error("[/api/images] fatal", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "unknown" },
      { status: 500 }
    );
  }
}

export const runtime = "edge";
