// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import OpenAI from "openai";
import { parse as partialJsonParse } from "partial-json";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ------------- helpers -------------
const toJsonb = (v: unknown) => JSON.stringify(v ?? null);
const short = (s: string, n = 600) =>
  (s || "").slice(0, n) + ((s || "").length > n ? " …[truncated]" : "");
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ------------- input validation -------------
const Traveler = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string().optional(),
  homeLocation: z.string(),
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

// ------------- model target -------------
const DestFare = z.object({
  travelerName: z.string(),
  from: z.string(),
  avgUSD: z.number(),
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

  // NEW: short phrases to drive /api/images
  image_queries: z.array(z.string()).optional(),

  // (kept for compatibility if you still want to display static photos somewhere)
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

// ------------- prompt -------------
function buildPrompt(input: z.infer<typeof Body>) {
  const { travelers, timeframe, suggestions } = input;

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

  // *** Example shows simple, short image_queries ***
  const example = `
{
  "name": "San Diego",
  "slug": "san-diego",
  "narrative": "Why it fits the group; include a 2–3 bullet micro-itinerary inside the prose.",
  "months": [
    { "month": "${timeframe.startMonth}", "note": "Cherry Blossom Festival at Balboa Park; Gaslamp Spring Fling street party" },
    { "month": "${timeframe.endMonth}", "note": "La Jolla sea caves kayak season; Pacific Beach boardwalk events" }
  ],
  "per_traveler_fares": [
    { "travelerName": "${travelers[0].name}", "from": "${travelers[0].homeLocation}", "avgUSD": 310,
      "monthBreakdown": [
        { "month": "${timeframe.startMonth}", "avgUSD": 300 },
        { "month": "${timeframe.endMonth}", "avgUSD": 340 }
      ]
    }
  ],
  "map_center": { "lat": 32.7157, "lon": -117.1611 },
  "map_markers": [
    { "name": "La Jolla Cove", "position": [32.8500, -117.2720] },
    { "name": "Balboa Park", "position": [32.7316, -117.1465] },
    { "name": "Gaslamp Quarter", "position": [32.7116, -117.1607] }
  ],
  "image_queries": [
    "La Jolla Cove tide pools",
    "Balboa Park Botanical Building",
    "Gaslamp Quarter nightlife neon",
    "Sunset Cliffs sunset",
    "Mission Beach boardwalk bikes",
    "Little Italy farmers market",
    "USS Midway flight deck",
    "North Park street art murals"
  ]
}
`.trim();

  // Prompt rules
  return `
You're a group-trip analyst. Produce **exactly 5 destinations** as strict JSON.

TRAVELERS
${tableHeader}${rows}

TIMEFRAME: ${timeframe.startMonth} → ${timeframe.endMonth}
USER IDEAS (free text, themes, or keywords): ${suggestions?.trim() || "none"}

Requirements:
- Optimize for cost and fit across the group, not just one person.
- For each destination, return:
  • "name", "slug" (kebab-case)
  • "narrative": include a tiny 2–3 bullet **micro-itinerary** inside the prose
  • "per_traveler_fares": ARRAY of { travelerName, from, avgUSD, monthBreakdown? }
  • "months": ARRAY of { month: "YYYY-MM", note }, where the **note lists real, notable events/festivals** in that city for that month (or useful seasonal specifics)
  • "map_center" and optional "map_markers" (a few named pins the group would actually visit)
  • "image_queries": ARRAY of **8–12 short phrases** to fetch live photos.
      - Build from the micro-itinerary landmarks AND the group's interests/keywords from the “USER IDEAS” table.
      - Keep each phrase short and concrete: e.g., "La Jolla Cove tide pools", "Sixth Street live music", "Barton Springs swimming".
      - Avoid long run-on phrases or mixing too many concepts in one query.

Also return:
- "final_recommendation" with the strongest pick and why.
- Optional "group_fit": { summary, priorities[], tradeoffs[] }.

Return JSON like:
{
  "final_recommendation": "…",
  "group_fit": { "summary": "…", "priorities": ["…"], "tradeoffs": ["…"] },
  "destinations": [ ${example}, ... x5 total ]
}
`.trim();
}

// ------------- normalization helpers -------------
type Travelers = z.infer<typeof Body>["travelers"];

function normalizePerTravelerFares(
  ptf: unknown,
  travelers: Travelers
): Array<z.infer<typeof DestFare>> {
  if (Array.isArray(ptf)) {
    return ptf
      .map((x: any) => {
        if (!x || typeof x !== "object" || typeof x.travelerName !== "string")
          return null;
        const match = travelers.find(
          (t) =>
            t.name.trim().toLowerCase() === x.travelerName.trim().toLowerCase()
        );
        const avg = Number(x.avgUSD);
        if (!Number.isFinite(avg)) return null;
        return {
          travelerName: x.travelerName,
          from: typeof x.from === "string" ? x.from : match?.homeLocation || "UNKNOWN",
          avgUSD: avg,
          monthBreakdown: Array.isArray(x.monthBreakdown)
            ? x.monthBreakdown
                .map((m: any) =>
                  m &&
                  typeof m === "object" &&
                  typeof m.month === "string" &&
                  Number.isFinite(Number(m.avgUSD))
                    ? { month: m.month, avgUSD: Number(m.avgUSD) }
                    : null
                )
                .filter(Boolean) as { month: string; avgUSD: number }[]
            : undefined,
        };
      })
      .filter(Boolean) as any[];
  }
  if (ptf && typeof ptf === "object") {
    const out: any[] = [];
    for (const [key, val] of Object.entries(ptf as Record<string, any>)) {
      const avg =
        typeof val === "number" ? val : Number(val?.avgUSD ?? val?.price ?? val);
      if (!Number.isFinite(avg)) continue;
      const match = travelers.find(
        (t) => t.name.trim().toLowerCase() === key.trim().toLowerCase()
      );
      out.push({
        travelerName: key,
        from: match?.homeLocation || "UNKNOWN",
        avgUSD: Number(avg),
        monthBreakdown: Array.isArray((val as any)?.monthBreakdown)
          ? ((val as any).monthBreakdown as any[])
              .map((m: any) =>
                m &&
                typeof m === "object" &&
                typeof m.month === "string" &&
                Number.isFinite(Number(m.avgUSD))
                  ? { month: m.month, avgUSD: Number(m.avgUSD) }
                  : null
              )
              .filter(Boolean)
          : undefined,
      });
    }
    return out;
  }
  return [];
}

function normalizeMonths(
  months: unknown,
  fallbackMonth: string
): { month: string; note: string }[] | undefined {
  if (Array.isArray(months)) {
    const arr = (months as unknown[])
      .map((m) => {
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
  if (typeof months === "string" && months.trim())
    return [{ month: fallbackMonth, note: months.trim() }];
  return undefined;
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

// Build concise phrases from suggestions + narrative (fallback if model misses)
function synthesizeImageQueries(
  city: string,
  narrative: string,
  markerNames: string[],
  suggestions: string
): string[] {
  const base = [city];
  const n = (narrative || "").toLowerCase();
  const s = (suggestions || "").toLowerCase();

  const pick = (word: string, phrase: string) =>
    n.includes(word) || s.includes(word) ? [phrase] : [];

  const list = [
    ...markerNames.slice(0, 5),
    ...pick("beach", `${city} beach`),
    ...pick("museum", `${city} museum`),
    ...pick("nightlife", `${city} nightlife`),
    ...pick("market", `${city} market`),
    ...pick("music", `${city} live music`),
    ...pick("hiking", `${city} hiking trail`),
    ...pick("park", `${city} city park`),
    ...pick("art", `${city} street art`),
    ...base,
  ]
    .map((x) => x.trim())
    .filter(Boolean);

  // Make them short, concrete, unique
  const uniq = Array.from(new Set(list))
    .map((p) => p.replace(/\s+/g, " "))
    .filter((p) => p.length <= 60);

  // Ensure at least 8
  while (uniq.length < 8) uniq.push(`${city} skyline`);
  return uniq.slice(0, 12);
}

function fallbackFinalRecommendation(destinations: any[]): string {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    return "We compared five options and chose the best overall fit for your group.";
  }
  let best = destinations[0];
  let bestAvg = Infinity;
  for (const d of destinations) {
    const fares = Array.isArray(d.per_traveler_fares) ? d.per_traveler_fares : [];
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

// ------------- route -------------
export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const rawBody = await req.json();
    console.log(`[plan ${reqId}] Incoming body keys:`, Object.keys(rawBody || {}));

    let body: z.infer<typeof Body>;
    try {
      body = Body.parse(rawBody);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod body error:`, e?.errors || e);
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const prompt = buildPrompt(body);
    console.log(
      `[plan ${reqId}] Model: ${MODEL} | Prompt length: ${prompt.length}\n` +
        `[plan ${reqId}] Prompt head:\n${short(prompt)}`
    );

    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return strict JSON that matches the schema. Arrays must be arrays.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[plan ${reqId}] OpenAI raw head:\n${short(raw)}`);
    if (!raw) throw new Error("OpenAI returned empty content");

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn(`[plan ${reqId}] Strict parse failed; using partial-json.`);
      json = partialJsonParse(raw);
    }
    if (!json || typeof json !== "object") throw new Error("Non-object JSON");

    if (!Array.isArray(json.destinations)) {
      if (Array.isArray(json.options)) json.destinations = json.options;
      else throw new Error("Missing destinations[]");
    }

    if (json.destinations.length > 5) json.destinations = json.destinations.slice(0, 5);
    while (json.destinations.length < 5) json.destinations.push({});

    json.destinations = json.destinations.map((d: any, i: number) => {
      const base = d && typeof d === "object" ? d : {};
      const { name, slug } = ensureNameSlug(base, i);

      const fares = normalizePerTravelerFares(
        base.per_traveler_fares,
        body.travelers
      );
      const months = normalizeMonths(base.months, body.timeframe.startMonth);

      const markerNames: string[] = Array.isArray(base.map_markers)
        ? base.map_markers.map((m: any) => m?.name).filter(Boolean)
        : [];

      // image_queries: prefer model’s, else synthesize concise phrases
      let image_queries: string[] | undefined = Array.isArray(base.image_queries)
        ? base.image_queries
            .map((s: any) => String(s || "").trim())
            .filter(Boolean)
            .slice(0, 12)
        : undefined;

      if (!image_queries || image_queries.length < 6) {
        image_queries = synthesizeImageQueries(
          name,
          String(base.narrative || ""),
          markerNames,
          body.suggestions || ""
        );
      }

      const narrative =
        typeof base.narrative === "string" && base.narrative.trim()
          ? base.narrative.trim()
          : `Why ${name} could fit your group.`;

      // Keep all enrichments in analysis for the UI to consume
      const analysis = {
        suggested_month: base.suggested_month,
        seasonal_warnings: base.seasonal_warnings,
        satisfies: base.satisfies,
        analytics: base.analytics,
        map_center: base.map_center,
        map_markers: base.map_markers,
        image_queries,
        photos: Array.isArray(base.photos) ? base.photos.slice(0, 4) : undefined,
        photo_attribution:
          typeof base.photo_attribution === "string" ? base.photo_attribution : undefined,
        highlights: Array.isArray(base.highlights) ? base.highlights : undefined,
      };

      return {
        name,
        slug,
        narrative,
        months,
        per_traveler_fares: fares,
        map_center: analysis.map_center,
        map_markers: analysis.map_markers,
        image_queries, // top-level convenience (optional)
        photos: analysis.photos,
        photo_attribution: analysis.photo_attribution,
        analysis,
      };
    });

    if (!json.final_recommendation || typeof json.final_recommendation !== "string") {
      json.final_recommendation = fallbackFinalRecommendation(json.destinations);
    }
    if (!json.group_fit || typeof json.group_fit !== "object") {
      json.group_fit = { summary: "Balanced for cost, convenience, and interests." };
    }

    // Validate
    let parsed: z.infer<typeof PlanSchema>;
    try {
      parsed = PlanSchema.parse(json);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod output error:`, e?.errors || e);
      console.error(`[plan ${reqId}] Raw out:\n${short(JSON.stringify(json || {}), 2000)}`);
      return new NextResponse("Model output did not match schema", { status: 400 });
    }

    // Summary
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

    // Save plan
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
        toJsonb(json),
        toJsonb(parsed.group_fit ?? null),
      ]
    );

    // Save destinations
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
          toJsonb(d), // includes image_queries, markers, etc.
        ]
      );
    }

    console.log(`[plan ${reqId}] Done. planId=${plan.id}`);
    return NextResponse.json({ planId: plan.id });
  } catch (err: any) {
    console.error("[/api/plan] Fatal:", err?.response?.data ?? err?.message ?? err);
    const msg = err?.response?.data?.error?.message || err?.message || "Unknown error";
    return new NextResponse(msg, { status: 400 });
  }
}
