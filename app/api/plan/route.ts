import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import OpenAI from "openai";
import { parse as partialJsonParse } from "partial-json";

export const runtime = "nodejs"; // 'pg' requires node runtime

// ------------ helpers ------------
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// stringify + null-safe
const toJsonb = (v: unknown) => JSON.stringify(v ?? null);

// safe log head
const short = (s: string, n = 500) =>
  (s || "").slice(0, n) + ((s || "").length > n ? " …[truncated]" : "");

// slugify
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ------------ input validation ------------
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

// ------------ model output validation (strict target) ------------
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

  // optional enrichments
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

  // NEW: photo collage support (shown on the detail page)
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

// ------------ prompt ------------
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

  // Example now includes photos + attribution (Wikimedia only)
  const example = `
EXAMPLE DESTINATION (shape only, values illustrative):
{
  "name": "Los Angeles",
  "slug": "los-angeles",
  "narrative": "Why it's good for this group… Include 2–3 bullet micro-itinerary inside the prose.",
  "months": [
    { "month": "${timeframe.startMonth}", "note": "Mild weather; shoulder season" }
  ],
  "per_traveler_fares": [
    { "travelerName": "${travelers[0].name}", "from": "${travelers[0].homeLocation}", "avgUSD": 350,
      "monthBreakdown": [
        { "month": "${timeframe.startMonth}", "avgUSD": 340 },
        { "month": "${timeframe.endMonth}", "avgUSD": 410 }
      ]
    }
  ],
  "suggested_month": "${timeframe.startMonth}",
  "seasonal_warnings": [{ "month": "${timeframe.endMonth}", "note": "Peak heat / crowds" }],
  "satisfies": [{ "travelerName": "${travelers[0].name}", "reason": "Beach + resorts" }],
  "analytics": { "avgUSD": 400, "varianceUSD": 80, "cheapestMonth": "${timeframe.startMonth}", "mostExpensiveMonth": "${timeframe.endMonth}" },
  "map_center": { "lat": 34.0522, "lon": -118.2437 },
  "map_markers": [
    { "name": "Santa Monica Pier", "position": [34.0101, -118.4965], "blurb": "Iconic pier" }
  ],
  "photos": [
    "https://upload.wikimedia.org/…/photo1.jpg",
    "https://upload.wikimedia.org/…/photo2.jpg",
    "https://upload.wikimedia.org/…/photo3.jpg",
    "https://upload.wikimedia.org/…/photo4.jpg"
  ],
  "photo_attribution": "Photos via Wikimedia Commons contributors (CC BY-SA or public domain)."
}
`.trim();

  return `
You're a travel analyst for indecisive group trips. Produce **exactly 5 destinations** with opinionated reasoning and airfare estimates. Output **strict JSON**.

TRAVELERS
${tableHeader}${rows}

TIMEFRAME: ${timeframe.startMonth} → ${timeframe.endMonth}
USER IDEAS: ${suggestions?.trim() || "none"}

Rules:
- If ANY traveler includes the phrase "dislikes travel", **center the trip near their home** (${anchor}).
- Otherwise, **minimize total group flight cost** while balancing interests (families, kids, mobility, vibes).
- For each destination:
  • "name" (string) and "slug" (kebab-case)
  • "narrative": WHY it fits the group (**include a tiny 2–3 bullet micro-itinerary inside the prose**)
  • "per_traveler_fares": ARRAY of { travelerName, from, avgUSD, monthBreakdown? } (monthBreakdown is an ARRAY, not a map)
  • "months": ARRAY of { month: "YYYY-MM", note: string }
  • "photos": ARRAY of **exactly 4** hotlink-safe **Wikimedia Commons** URLs that visually represent the destination (landmarks/landscapes). No stock sites other than Wikimedia. No portraits of identifiable people.
  • "photo_attribution": Short string crediting "Wikimedia Commons contributors" and license (e.g., "CC BY-SA" or "public domain").
  • OPTIONAL enrichments: "satisfies", "suggested_month", "seasonal_warnings", "analytics", "map_center", "map_markers"
- Provide "final_recommendation": one strong pick & why (cost + fit + tradeoffs).
- Provide optional "group_fit": { summary, priorities[], tradeoffs[] }.

Return JSON like:
{
  "final_recommendation": "…",
  "group_fit": { "summary": "…", "priorities": ["…"], "tradeoffs": ["…"] },
  "destinations": [ ${example} , ... x5 total ]
}
`.trim();
}

// ------------ normalizers for sloppy model output ------------
type Travelers = z.infer<typeof Body>["travelers"];

function normalizePerTravelerFares(
  ptf: unknown,
  travelers: Travelers
): Array<z.infer<typeof DestFare>> {
  // Already valid array?
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

  // Object map form
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

// ------------ route ------------
export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const rawBody = await req.json();
    console.log(`[plan ${reqId}] Incoming body keys:`, Object.keys(rawBody || {}));

    // validate input
    let body: z.infer<typeof Body>;
    try {
      body = Body.parse(rawBody);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod body validation error:`, e?.errors || e);
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const prompt = buildPrompt(body);
    console.log(
      `[plan ${reqId}] Model: ${MODEL} | Prompt length: ${prompt.length}\n` +
        `[plan ${reqId}] Prompt head:\n${short(prompt)}`
    );

    // ask OpenAI (JSON enforced)
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You produce strict JSON that matches the spec exactly. Arrays must be arrays (not objects).",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[plan ${reqId}] OpenAI raw head:\n${short(raw)}`);
    if (!raw) throw new Error("OpenAI returned empty content");

    // strict parse → fallback partial
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn(`[plan ${reqId}] Strict parse failed; trying partial-json.`);
      json = partialJsonParse(raw);
    }

    // -------- normalize BEFORE validation --------
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

      // fix name/slug
      const { name, slug } = ensureNameSlug(base, i);

      // normalize per_traveler_fares
      const fares = normalizePerTravelerFares(
        base.per_traveler_fares,
        body.travelers
      );

      // normalize months
      const months = normalizeMonths(base.months, body.timeframe.startMonth);

      // pass-through enrichments + photos
      const analysis = {
        suggested_month: base.suggested_month,
        seasonal_warnings: base.seasonal_warnings,
        satisfies: base.satisfies,
        analytics: base.analytics,
        map_center: base.map_center,
        map_markers: base.map_markers,
        micro_itinerary: base.micro_itinerary,
        photos: Array.isArray(base.photos) ? base.photos.slice(0, 4) : undefined,
        photo_attribution:
          typeof base.photo_attribution === "string" ? base.photo_attribution : undefined,
      };

      // narrative fallback
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

        // keep enrichments on the destination; we'll also store them in analysis column
        suggested_month: analysis.suggested_month,
        seasonal_warnings: analysis.seasonal_warnings,
        satisfies: analysis.satisfies,
        analytics: analysis.analytics,
        map_center: analysis.map_center,
        map_markers: analysis.map_markers,

        // NEW top-level (optional) fields — also duplicated into analysis for UI
        photos: analysis.photos,
        photo_attribution: analysis.photo_attribution,

        // everything is also available in analysis jsonb
        analysis,
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

    // -------- validate against strict schema --------
    let parsed: z.infer<typeof PlanSchema>;
    try {
      parsed = PlanSchema.parse(json);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod output validation error:`, e?.errors || e);
      console.error(
        `[plan ${reqId}] Raw model output:\n${short(JSON.stringify(json || {}), 2000)}`
      );
      return new NextResponse("Model output did not match schema", { status: 400 });
    }

    // ---- compute summary ----
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

    console.log(`[plan ${reqId}] Saving plan`, {
      timeframe: body.timeframe,
      travelersCount: body.travelers.length,
      destSlugs: summary.destinations.map((d) => d.slug),
    });

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
        toJsonb(json), // normalized model output
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
          toJsonb(d), // includes photos & photo_attribution
        ]
      );
    }

    console.log(`[plan ${reqId}] Done. planId=${plan.id}`);
    return NextResponse.json({ planId: plan.id });
  } catch (err: any) {
    console.error("[/api/plan] Fatal:", err?.response?.data ?? err?.message ?? err);
    const msg =
      err?.response?.data?.error?.message || err?.message || "Unknown error";
    return new NextResponse(msg, { status: 400 });
  }
}
