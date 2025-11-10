// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

type Img = { url: string; title?: string; source: "wikimedia" };

const BLOCK_KEYWORDS = [
  "book","cover","manuscript","folio","page","leaf","scan","document","title page",
  "newspaper","periodical","magazine","catalog","poster","advertisement","label",
  "map","chart","seal","coat of arms","emblem","flag","logo","ticket","stamp",
  "pamphlet","certificate","receipt","brochure","blueprint","plan","drawing"
];

function looksDocumentLike(s: string) {
  const t = s.toLowerCase();
  return BLOCK_KEYWORDS.some(k => t.includes(k));
}
function isOkMime(m?: string) {
  if (!m) return true;
  if (!m.startsWith("image/")) return false;
  if (m.includes("svg")) return false;
  return true;
}
function aspectScore(w: number, h: number) {
  // prefer natural photo ranges (portrait/landscape up to ~2:1)
  if (!w || !h) return 0;
  const r = w / h;
  if (r < 0.5 || r > 2.2) return 0.2;
  if (r > 0.75 && r < 1.6) return 1.0;
  return 0.8;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const terms: string[] = Array.isArray(body?.terms) ? body.terms : [];
    const count = Math.min(80, Math.max(12, Number(body?.count) || 40)); // fetch plenty, filter down

    if (!terms.length) {
      return NextResponse.json({ images: [] });
    }

    // Query Wikimedia: generator=search and prop=imageinfo&extmetadata for URLs + sizes
    const search = encodeURIComponent(terms.join(" | "));
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&` +
      `generator=search&gsrsearch=${search}&gsrlimit=${count}&` +
      `prop=imageinfo|info|categories&inprop=url&` +
      `iiprop=url|mime|size|extmetadata&iiurlwidth=2000&iiurlheight=2000&cllimit=20`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ images: [] }, { status: 200 });

    const data = await res.json();
    const pages = data?.query?.pages ? Object.values<any>(data.query.pages) : [];

    const imgs: Img[] = pages
      .map((p: any) => {
        const title: string = p?.title || "";
        const cats: string[] = (p?.categories || []).map((c: any) => c?.title || "");
        const ii = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
        const url = ii?.thumburl || ii?.url;
        const mime: string | undefined = ii?.mime;
        const w: number = ii?.thumbwidth || ii?.width || 0;
        const h: number = ii?.thumbheight || ii?.height || 0;

        if (!url || !isOkMime(mime)) return null;

        // BLOCK by obvious doc signals first
        const joined = `${title} ${cats.join(" ")}`;
        if (looksDocumentLike(joined)) return null;

        // Basic dimension bar: prefer decent sized images
        if (w < 640 || h < 480) return null;

        // Guard against scans of extremely tall pages or super-wide strips
        const aScore = aspectScore(w, h);
        if (aScore < 0.3) return null;

        return { url, title, source: "wikimedia" as const };
      })
      .filter(Boolean) as Img[];

    // If filtering was very strict, fall back to first N safe mimetypes
    const unique = Array.from(new Map(imgs.map(i => [i.url, i])).values());
    return NextResponse.json({ images: unique.slice(0, count) });
  } catch (e) {
    return NextResponse.json({ images: [] }, { status: 200 });
  }
}

export const runtime = "edge";
