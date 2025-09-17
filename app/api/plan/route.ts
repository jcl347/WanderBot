// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { parse as partialJsonParse } from "partial-json";
import { q } from "@/lib/db";

export const runtime = "nodejs";

// ---------------- helpers ----------------
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// stringify + null-safe
const toJsonb = (v: unknown) => JSON.stringify(v ?? null);

// safe log head/tail
const short = (s: string, n = 900) =>
  (s || "").slice(0, n) + ((s || "").length > n ? " …[truncated]" : "");

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ---------------- input validation ----------------
const Traveler = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string().optional(),
  homeLocation: z.string(), // city or airport code the UI shows
  age: z.string().optional(),
  gender: z.string().optional(),
  personality: z.string().optional(),
  isUser: z.boolean().optional(),
  spouse: z.string().optional(),
  kids: z.string().optional(),
});

const Body = z.object({
  travelers: z.array(Traveler).min(1),
  timeframe: z.object({ startMonth: z.string(), endMonth: z.string() }),
  suggestions: z.string().optional(),
});

// ---------------- model output (strict) ----------------
const DestFare = z.object({
  travelerName: z.string(),
  from: z.string(),
  avgUSD: z.number(), // overall average (quick read)
  monthBreakdown: z
    .array(z.object({ month: z.string(), avgUSD: z.number() }))
    .optional(),
});

const DestSchema = z.object({
  name: z.string(),
  slug: z.string(),
  narrative: z.string(),
  months: z.array(z.object({ month: z.string(), note: z.string() })).optional(),
  per_traveler_fares: z.array(DestFare),

  // enrichments
  suggested_month: z.string().optional(),
  seasonal_warnings: z
    .array(z.object({ month: z.string(), note: z.string() }))
    .optional(),
  satisfies: z
    .array(z.object({ travelerName: z.string(), reason: z.string() }))
    .optional(),
  analytics: z
    .object({
      avgUSD: z.number().optional(),
      varianceUSD: z.number().optional(),
      cheapestMonth: z.string().optional(),
      mostExpensiveMonth: z.string().optional(),
      // optionally the model may return distanceBand, confidence, etc.—we ignore if present
    })
    .optional(),

  map_center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  map_markers: z
    .array(
      z.object({
        name: z.string(),
        position: z.tuple([z.number(), z.number()]),
        blurb: z.string().optional(),
      })
    )
    .optional(),

  image_queries: z.array(z.string()).optional(),

  photos: z.array(z.string().url()).optional(),
  photo_attribution: z.string().optional(),
});

const PlanSchema = z.object({
  final_recommendation: z.string(),
  group_fit: z
    .object({
      summary: z.string(),
      priorities: z.array(z.string()).optional(),
      tradeoffs: z.array(z.string()).optional(),
    })
    .optional(),
  destinations: z.array(DestSchema).length(5),
});

// ---------------- small utils ----------------
function listMonthsInclusive(startYM: string, endYM: string): string[] {
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  const out: string[] = [];
  let y = sy,
    m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// Clamp & very light smoothing to avoid single-month spikes
function smoothFareSeries(
  series: { month: string; avgUSD: number }[]
): { month: string; avgUSD: number }[] {
  if (!Array.isArray(series) || series.length === 0) return series || [];
  const s = series
    .map((x) => ({
      month: x.month.slice(0, 7),
      // clamp to reasonable bounds for round-trip economy
      avgUSD: Math.min(5000, Math.max(60, Number(x.avgUSD) || 0)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 3-point median smoothing (no subplots; just tone down wild outliers)
  const out = s.map((x, i) => {
    const window = [s[i - 1]?.avgUSD, s[i].avgUSD, s[i + 1]?.avgUSD].filter(
      (v) => typeof v === "number"
    ) as number[];
    if (window.length < 2) return x;
    const sorted = [...window].sort((a, b) => a - b);
    const med =
      sorted.length % 2
        ? sorted[(sorted.length / 2) | 0]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    // if current deviates > 70% from local median, pull it closer (still keep some shape)
    if (Math.abs(x.avgUSD - med) / Math.max(1, med) > 0.7) {
      return { month: x.month, avgUSD: Math.round(med * 0.85 + x.avgUSD * 0.15) };
    }
    return x;
  });

  return out;
}

function shortCity(s: string) {
  // Use first token as cheap heuristic for “City” when users pass “City, ST (XYZ)”
  return (s || "").split(/[,(]/)[0].trim() || s || "";
}

// Coerce/clean markers (avoid string coords)
function normalizeMarkers(
  raw: any
): { name: string; position: [number, number]; blurb?: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { name: string; position: [number, number]; blurb?: string }[] = [];
  for (const m of raw) {
    const name = typeof m?.name === "string" ? m.name : "Pin";
    const lat = Number(m?.position?.[0]);
    const lon = Number(m?.position?.[1]);
    const blurb = typeof m?.blurb === "string" ? m.blurb : undefined;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      out.push({ name, position: [lat, lon], blurb });
    }
  }
  return out.length ? out : undefined;
}

// Ensure month notes cover the window
function expandMonthsToRange(
  months: { month: string; note: string }[] | undefined,
  startMonth: string,
  endMonth: string
): { month: string; note: string }[] {
  const map = new Map<string, string>();
  (months || []).forEach((m) => {
    if (m?.month && typeof m.note === "string") {
      map.set(m.month.slice(0, 7), m.note.trim());
    }
  });

  const out: { month: string; note: string }[] = [];
  for (const key of listMonthsInclusive(startMonth, endMonth)) {
    out.push({
      month: key,
      note:
        map.get(key) ||
        "No marquee festival flagged; typical seasonal conditions and regular happenings.",
    });
  }
  return out;
}

// Build short image queries if the model omitted them
function fallbackImageQueries(name: string, markerNames: string[]) {
  const city = String(name || "").trim();
  const basics = [
    `${city} skyline`,
    `${city} downtown`,
    `${city} landmarks`,
    `${city} street art`,
    `${city} festival`,
    `${city} live music`,
    `${city} market`,
    `${city} nightlife`,
  ];
  const poi = (markerNames || []).slice(0, 4).map((n) => `${city} ${n}`);
  const set = new Set([...basics, ...poi].filter(Boolean));
  return Array.from(set).slice(0, 12);
}

function normalizeMonths(
  months: unknown,
  fallbackMonth: string
): { month: string; note: string }[] | undefined {
  if (Array.isArray(months)) {
    const arr = (months as unknown[])
      .map((m: unknown) => {
        const x = m as any;
        if (
          x &&
          typeof x === "object" &&
          typeof x.month === "string" &&
          typeof x.note === "string"
        ) {
          return { month: x.month, note: x.note };
        }
        if (typeof m === "string") return { month: fallbackMonth, note: m };
        return null;
      })
      .filter(Boolean) as { month: string; note: string }[];
    return arr.length ? arr : undefined;
  }
  if (typeof months === "string" && months.trim()) {
    return [{ month: fallbackMonth, note: months.trim() }];
  }
  return undefined;
}

type Travelers = z.infer<typeof Body>["travelers"];

function normalizePerTravelerFares(
  ptf: unknown,
  travelers: Travelers
): Array<z.infer<typeof DestFare>> {
  if (Array.isArray(ptf)) {
    return ptf
      .map((x: unknown) => {
        const t = x as any;
        if (t && typeof t === "object" && typeof t.travelerName === "string") {
          const from =
            typeof t.from === "string"
              ? t.from
              : travelers.find(
                  (tr) =>
                    tr.name.trim().toLowerCase() ===
                    t.travelerName.trim().toLowerCase()
                )?.homeLocation || "UNKNOWN";
          const avg = Number(t.avgUSD);
          if (Number.isFinite(avg)) {
            return {
              travelerName: t.travelerName,
              from,
              avgUSD: avg,
              monthBreakdown: Array.isArray(t.monthBreakdown)
                ? (t.monthBreakdown as unknown[])
                    .map((m: unknown) => {
                      const mm = m as any;
                      return mm &&
                        typeof mm === "object" &&
                        typeof mm.month === "string" &&
                        Number.isFinite(Number(mm.avgUSD))
                        ? { month: mm.month, avgUSD: Number(mm.avgUSD) }
                        : null;
                    })
                    .filter(Boolean) as { month: string; avgUSD: number }[]
                : undefined,
            };
          }
        }
        return null;
      })
      .filter(Boolean) as Array<z.infer<typeof DestFare>>;
  }

  if (ptf && typeof ptf === "object") {
    const out: Array<z.infer<typeof DestFare>> = [];
    for (const [key, val] of Object.entries(ptf as Record<string, any>)) {
      const avg =
        typeof val === "number"
          ? val
          : Number(val?.avgUSD ?? val?.price ?? val);
      if (!Number.isFinite(avg)) continue;
      const match = travelers.find(
        (t) => t.name.trim().toLowerCase() === key.trim().toLowerCase()
      );
      out.push({
        travelerName: key,
        from: match?.homeLocation || "UNKNOWN",
        avgUSD: Number(avg),
        monthBreakdown: Array.isArray((val as any)?.monthBreakdown)
          ? ((val as any).monthBreakdown as unknown[])
              .map((m: unknown) => {
                const mm = m as any;
                return mm &&
                  typeof mm === "object" &&
                  typeof mm.month === "string" &&
                  Number.isFinite(Number(mm.avgUSD))
                  ? { month: mm.month, avgUSD: Number(mm.avgUSD) }
                  : null;
              })
              .filter(Boolean) as { month: string; avgUSD: number }[]
          : undefined,
      });
    }
    return out;
  }
  return [];
}

function ensureNameSlug(d: any, index: number) {
  const name =
    typeof d.name === "string" && d.name.trim()
      ? d.name.trim()
      : `Option ${index + 1}`;
  const slug =
    typeof d.slug === "string" && d.slug.trim()
      ? slugify(d.slug.trim())
      : slugify(name);
  return { name, slug };
}

function fallbackFinalRecommendation(destinations: any[]): string {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    return "We compared five options and chose the best overall fit for your group.";
  }
  let best = destinations[0];
  let bestAvg = Infinity;
  for (const d of destinations) {
    const fares = Array.isArray(d.per_traveler_fares)
      ? d.per_traveler_fares
      : [];
    const avg =
      fares.length > 0
        ? fares.reduce((a: number, f: any) => a + Number(f?.avgUSD || 0), 0) /
          fares.length
        : Infinity;
    if (avg < bestAvg) {
      bestAvg = avg;
      best = d;
    }
  }
  return `Top pick: ${best?.name || "Option 1"} — best overall balance of cost and fit for your group.`;
}

// Fill & smooth month series for every traveler
function enforceFareCoverageAndSmooth(
  fares: Array<z.infer<typeof DestFare>>,
  startMonth: string,
  endMonth: string
) {
  const months = listMonthsInclusive(startMonth, endMonth);
  for (const f of fares) {
    const mb = Array.isArray(f.monthBreakdown) ? [...f.monthBreakdown] : [];
    const idx = new Map(mb.map((x) => [x.month.slice(0, 7), x.avgUSD]));
    // Fill missing months with the overall avgUSD
    for (const m of months) {
      if (!idx.has(m)) mb.push({ month: m, avgUSD: f.avgUSD });
    }
    const sorted = mb
      .map((x) => ({ month: x.month.slice(0, 7), avgUSD: Number(x.avgUSD) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Light smoothing + clamp
    f.monthBreakdown = smoothFareSeries(sorted);
    // Recompute overall avg as mean of the window
    const mean =
      f.monthBreakdown.reduce((a, x) => a + x.avgUSD, 0) /
      Math.max(1, f.monthBreakdown.length);
    f.avgUSD = Math.round(mean);
  }
}

// ---------------- prompt ----------------
function buildPrompt(input: z.infer<typeof Body>) {
  const { travelers, timeframe, suggestions } = input;

  const dislikes = travelers.find((t) =>
    (t.personality || "").toLowerCase().includes("dislikes travel")
  );
  const anchor = dislikes?.homeLocation ?? "none";

  const tableHeader =
    "| Name | Me? | Relation | Home | Spouse | Kids | Personality |\n|---|---|---|---|---|---|---|\n";
  const rows = travelers
    .map(
      (t) =>
        `| ${t.name} | ${t.isUser ? "✅" : ""} | ${t.relationship ?? "—"} | ${
          t.homeLocation
        } | ${t.spouse ?? "—"} | ${t.kids ?? "0"} | ${(
          t.personality ?? ""
        ).replaceAll("|", "/")} |`
    )
    .join("\n");

  // Show numeric coords + short image queries explicitly
  const example = `
EXAMPLE DESTINATION (shape only):
{
  "name": "Los Angeles",
  "slug": "los-angeles",
  "narrative": "Why it fits this group… include a tiny 2–3 bullet micro-itinerary in prose.",
  "per_traveler_fares": [
    {
      "travelerName": "${travelers[0].name}",
      "from": "${shortCity(travelers[0].homeLocation)}",
      "avgUSD": 350,
      "monthBreakdown": [
        { "month": "${timeframe.startMonth}", "avgUSD": 340 },
        { "month": "${timeframe.endMonth}", "avgUSD": 410 }
      ]
    }
  ],
  "months": [
    { "month": "${timeframe.startMonth}", "note": "Specific major event/festival; quick seasonal tag" }
  ],
  "suggested_month": "${timeframe.startMonth}",
  "seasonal_warnings": [{ "month": "${timeframe.endMonth}", "note": "Peak heat/crowds" }],
  "map_center": { "lat": 34.0522, "lon": -118.2437 },
  "map_markers": [
    { "name": "Santa Monica Pier", "position": [34.0101, -118.4965], "blurb": "Iconic pier" }
  ],
  "image_queries": [
    "Los Angeles skyline",
    "Los Angeles street art",
    "Los Angeles live music",
    "Grand Central Market food",
    "Hollywood Bowl concert",
    "Santa Monica Pier"
  ]
}
`.trim();

  const monthWindow = `${timeframe.startMonth}–${timeframe.endMonth}`;

  return `
You are a travel analyst. Output **strict JSON** only (no prose), with **exactly 5 destinations**.

TRAVELERS
${tableHeader}${rows}

TIMEFRAME: ${timeframe.startMonth} → ${timeframe.endMonth}
USER IDEAS: ${suggestions?.trim() || "none"}

Airfare guidance for accuracy (no browsing; estimate using historical seasonality, hub connectivity, distance bands):
- Return **round-trip economy** prices in USD.
- Provide **"monthBreakdown" covering every month in ${monthWindow}** for each traveler (keys: month "YYYY-MM", avgUSD number).
- Keep prices realistic: clamp approx to **$60–$5000**; short-haul (≤1000 mi) often $120–$350; medium (1000–3000) $180–$650; long-haul (3000–6000) $400–$1200; very long-haul ($900–$2000+).
- Apply seasonality: summer/holidays ↑, shoulder ↓, extreme events (major festivals, spring breaks) ↑.
- Derive an overall "avgUSD" per traveler as the **mean of the monthly values** you return.

Hard requirements:
- For each destination:
  • "narrative": explain WHY it fits; **embed a tiny 2–3 bullet micro-itinerary in prose**.
  • "per_traveler_fares": for each traveler include { "travelerName", "from", "avgUSD", "monthBreakdown": [every month ${monthWindow}] }.
    - "from" should be the human-readable city or primary airport city (e.g., "Austin" not "AUS").
  • "months": also **cover every month** in the window; each "note" names a major event/festival if applicable; otherwise seasonal/holiday + recurring scene.
  • Map: "map_center" { "lat": number, "lon": number } and **6–10 "map_markers"** with numeric "position": [lat, lon] and short "blurb".
  • Imagery: **8–12 "image_queries"** (short phrases, "<city> <keyword>") blending landmarks, neighborhoods, museums/parks, food/nightlife/markets, and events you cited.
- If any traveler "dislikes travel", bias location near ${anchor}. Otherwise balance cost vs. interests.

Return JSON like:
{
  "final_recommendation": "…",
  "group_fit": { "summary": "…", "priorities": ["…"], "tradeoffs": ["…"] },
  "destinations": [ ${example} , … four more ]
}
`.trim();
}

// ---------------- route ----------------
export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const rawBody = await req.json();
    console.log(`[plan ${reqId}] incoming keys:`, Object.keys(rawBody || {}));

    // validate input
    let body: z.infer<typeof Body>;
    try {
      body = Body.parse(rawBody);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod body error:`, e?.errors || e);
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const prompt = buildPrompt(body);
    console.log(
      `[plan ${reqId}] Model=${MODEL} | prompt.length=${prompt.length}\n[prompt.head]\n${short(
        prompt,
        1200
      )}\n[prompt.tail]\n${short(prompt.slice(-1200), 1200)}`
    );

    // ask OpenAI (JSON enforced; tight structure)
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content:
            "You produce strict machine-parseable JSON matching the requested schema. No commentary or Markdown.",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    console.log(
      `[plan ${reqId}] openai.raw.head:\n${short(
        raw,
        1200
      )}\n[openai.raw.tail]\n${short(raw.slice(-1200), 1200)}`
    );
    if (!raw) throw new Error("OpenAI returned empty content");

    // strict parse → fallback partial
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn(`[plan ${reqId}] strict JSON.parse failed; trying partial-json`);
      json = partialJsonParse(raw);
    }

    // ---------- normalize BEFORE validation ----------
    if (!json || typeof json !== "object") {
      throw new Error("Model returned non-object JSON");
    }
    if (!Array.isArray(json.destinations)) {
      if (Array.isArray(json.options)) json.destinations = json.options;
      else throw new Error("Model did not return 'destinations' array");
    }

    // coerce exactly 5 items
    if (json.destinations.length > 5) json.destinations = json.destinations.slice(0, 5);
    while (json.destinations.length < 5) json.destinations.push({});

    json.destinations = json.destinations.map((d: any, i: number) => {
      const base = d && typeof d === "object" ? d : {};

      const { name, slug } = ensureNameSlug(base, i);

      // per-traveler fares
      const fares = normalizePerTravelerFares(
        base.per_traveler_fares,
        body.travelers
      );
      // guarantee full coverage & smooth spikes
      enforceFareCoverageAndSmooth(
        fares,
        body.timeframe.startMonth,
        body.timeframe.endMonth
      );

      // month notes
      const monthsRaw = normalizeMonths(base.months, body.timeframe.startMonth);
      const months = expandMonthsToRange(
        monthsRaw,
        body.timeframe.startMonth,
        body.timeframe.endMonth
      );

      // map
      const mc =
        base?.map_center &&
        Number.isFinite(Number(base.map_center.lat)) &&
        Number.isFinite(Number(base.map_center.lon))
          ? { lat: Number(base.map_center.lat), lon: Number(base.map_center.lon) }
          : undefined;
      const cleanedMarkers = normalizeMarkers(base.map_markers);

      // imagery
      let imageQueries: string[] | undefined = Array.isArray(base.image_queries)
        ? base.image_queries
            .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
            .filter(Boolean)
            .slice(0, 12)
        : undefined;

      if (!imageQueries || imageQueries.length < 6) {
        const markerNames = (cleanedMarkers || []).map((m) => m.name);
        imageQueries = fallbackImageQueries(name, markerNames);
      }

      const analysis = {
        suggested_month: base.suggested_month,
        seasonal_warnings: base.seasonal_warnings,
        satisfies: base.satisfies,
        analytics: base.analytics,
        map_center: mc,
        map_markers: cleanedMarkers,
        image_queries: imageQueries,
        photos: Array.isArray(base.photos) ? base.photos.slice(0, 4) : undefined,
        photo_attribution:
          typeof base.photo_attribution === "string" ? base.photo_attribution : undefined,
      };

      const narrative =
        typeof base.narrative === "string" && base.narrative.trim()
          ? base.narrative.trim()
          : `Why ${name} could fit your group: beaches, food, and an easy flight mix.`;

      return {
        name,
        slug,
        narrative,
        months,
        per_traveler_fares: fares,

        suggested_month: analysis.suggested_month,
        seasonal_warnings: analysis.seasonal_warnings,
        satisfies: analysis.satisfies,
        analytics: analysis.analytics,
        map_center: analysis.map_center,
        map_markers: analysis.map_markers,

        image_queries: analysis.image_queries,
        photos: analysis.photos,
        photo_attribution: analysis.photo_attribution,

        analysis, // store whole enriched object
      };
    });

    if (!json.final_recommendation || typeof json.final_recommendation !== "string") {
      json.final_recommendation = fallbackFinalRecommendation(json.destinations);
    }

    if (!json.group_fit || typeof json.group_fit !== "object") {
      json.group_fit = {
        summary: "Balanced for cost, convenience, and interests across the group.",
      };
    }

    // -------- validate --------
    let parsed: z.infer<typeof PlanSchema>;
    try {
      parsed = PlanSchema.parse(json);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod output error:`, e?.errors || e);
      console.error(`[plan ${reqId}] normalized json head:\n${short(JSON.stringify(json), 2000)}`);
      return new NextResponse("Model output did not match schema", { status: 400 });
    }

    // ---- compute summary for the chart ----
    const familySizeFor = (name: string) => {
      const t = body.travelers.find(
        (x) => x.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (!t) return 1;
      const kids = Number(t.kids || "0") || 0;
      const spouse = t.spouse?.trim() ? 1 : 0;
      return 1 + spouse + kids;
    };

    const summary = {
      destinations: parsed.destinations
        .map((d) => {
          const travelerTotal = d.per_traveler_fares.reduce((acc, f) => {
            const mult = familySizeFor(f.travelerName);
            return acc + f.avgUSD * mult;
          }, 0);

          const totalCount = body.travelers.reduce((acc, t) => {
            const kids = Number(t.kids || "0") || 0;
            const spouse = t.spouse?.trim() ? 1 : 0;
            return acc + 1 + spouse + kids;
          }, 0);

          const perPerson = totalCount ? travelerTotal / totalCount : travelerTotal;

          return {
            name: d.name,
            slug: d.slug,
            totalGroupUSD: Math.round(travelerTotal),
            avgPerPersonUSD: Math.round(perPerson),
          };
        })
        .sort((a, b) => a.totalGroupUSD - b.totalGroupUSD),
    };

    // Useful logs for Vercel (inspect airfare quality & map pins quickly)
    console.log(`[plan ${reqId}] parsed slugs=`, summary.destinations.map((d) => d.slug));
    console.log(
      `[plan ${reqId}] coords preview=`,
      parsed.destinations.map((d) => ({
        slug: d.slug,
        center: d.map_center || null,
        markers: (d.map_markers || []).length,
      }))
    );
    console.log(
      `[plan ${reqId}] fares preview=`,
      parsed.destinations.map((d) => ({
        slug: d.slug,
        fares: d.per_traveler_fares.map((f) => ({
          traveler: f.travelerName,
          avg: f.avgUSD,
          months: (f.monthBreakdown || []).map((m) => m.month),
        })),
      }))
    );
    console.log(
      `[plan ${reqId}] image_queries counts=`,
      parsed.destinations.map((d) => ({ slug: d.slug, n: d.image_queries?.length || 0 }))
    );

    // ---- save plan ----
    const [plan] = await q<{ id: string }>(
      `
      INSERT INTO plans
        (timeframe, travelers, suggestions, model, final_recommendation, summary, model_output, group_fit)
      VALUES
        ($1::jsonb,$2::jsonb,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
      RETURNING id
      `,
      [
        toJsonb(body.timeframe),
        toJsonb(body.travelers),
        body.suggestions ?? null,
        MODEL,
        parsed.final_recommendation,
        toJsonb(summary),
        toJsonb(json), // normalized model output incl. analysis
        toJsonb(parsed.group_fit ?? null),
      ]
    );

    // ---- save destinations ----
    for (const d of parsed.destinations) {
      const matched = summary.destinations.find((s) => s.slug === d.slug);
      const totals = {
        avgPerPerson: matched?.avgPerPersonUSD ?? null,
        totalGroup: matched?.totalGroupUSD ?? null,
      };

      await q(
        `
        INSERT INTO destinations
          (plan_id, slug, name, narrative, months, per_traveler_fares, totals, analysis)
        VALUES
          ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)
        `,
        [
          plan.id,
          d.slug,
          d.name,
          d.narrative,
          toJsonb(d.months ?? []),
          toJsonb(d.per_traveler_fares),
          toJsonb(totals),
          toJsonb(d), // includes image_queries, photos, coords, etc.
        ]
      );
    }

    console.log(`[plan ${reqId}] done planId=${plan.id}`);
    return NextResponse.json({ planId: plan.id });
  } catch (err: any) {
    console.error("[/api/plan] Fatal:", err?.response?.data ?? err?.message ?? err);
    const msg =
      err?.response?.data?.error?.message || err?.message || "Unknown error";
    return new NextResponse(msg, { status: 400 });
  }
}
