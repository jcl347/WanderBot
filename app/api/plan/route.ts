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

// ---------------- model output (strict) ----------------
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

  // for LiveCollage
  image_queries: z.array(z.string()).optional(),

  // optional media (kept flexible)
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

  const example = `
EXAMPLE DESTINATION (shape only):
{
  "name": "Los Angeles",
  "slug": "los-angeles",
  "narrative": "Why it fits this group… include a tiny 2–3 bullet micro-itinerary in prose.",
  "per_traveler_fares": [
    { "travelerName": "${travelers[0].name}", "from": "${travelers[0].homeLocation}", "avgUSD": 350,
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
    "Santa Monica Pier sunset",
    "The Getty museum architecture",
    "Downtown LA skyline night",
    "Grand Central Market food stalls",
    "Hollywood Bowl concert crowd",
    "Arts District street art murals"
  ]
}
`.trim();

  return `
You're a travel analyst for indecisive group trips. Produce **exactly 5 destinations** with opinionated reasoning and airfare estimates. Output **strict JSON**.

TRAVELERS
${tableHeader}${rows}

TIMEFRAME: ${timeframe.startMonth} → ${timeframe.endMonth}
USER IDEAS: ${suggestions?.trim() || "none"}

Rules:
- If ANY traveler includes "dislikes travel", **center the trip near their home** (${anchor}). Otherwise minimize total group flight cost while balancing interests.
- For each destination **return these keys exactly**:
  • "name" (string) and "slug" (kebab-case)
  • "narrative": WHY it fits the group (**embed a tiny 2–3 bullet micro-itinerary in prose**)
  • "per_traveler_fares": ARRAY of { travelerName, from, avgUSD, monthBreakdown? }  (monthBreakdown is an ARRAY)
  • "months": ARRAY that **covers every month between ${timeframe.startMonth} and ${timeframe.endMonth} inclusive**. Each note should call out a **specific major event/festival/parade/marathon/fair** for that month if applicable; otherwise the best seasonal hook (weather/shoulder/holiday) + a recurring scene (e.g., night market, beach bonfires).
  • "image_queries": ARRAY of **6–12 short search phrases** tailored to the group’s interests and the micro-itinerary (mix of landmarks, food/nightlife, parks/museums, and festivals).
  • OPTIONAL: "suggested_month", "seasonal_warnings", "satisfies", "analytics", "map_center", "map_markers"
- Also provide "final_recommendation" and optional "group_fit".

Return JSON like:
{
  "final_recommendation": "…",
  "group_fit": { "summary": "…", "priorities": ["…"], "tradeoffs": ["…"] },
  "destinations": [ ${example} , ... x5 total ]
}
`.trim();
}

// ---------------- normalizers ----------------
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

// Expand/force months to cover the entire requested window (inclusive)
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
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  let y = sy,
    m = sm;
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({
      month: key,
      note:
        map.get(key) ||
        "No marquee festival flagged; typical seasonal conditions and regular happenings.",
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
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
      const fares = normalizePerTravelerFares(
        base.per_traveler_fares,
        body.travelers
      );

      const monthsRaw = normalizeMonths(base.months, body.timeframe.startMonth);
      const months = expandMonthsToRange(
        monthsRaw,
        body.timeframe.startMonth,
        body.timeframe.endMonth
      );

      const analysis = {
        suggested_month: base.suggested_month,
        seasonal_warnings: base.seasonal_warnings,
        satisfies: base.satisfies,
        analytics: base.analytics,
        map_center: base.map_center,
        map_markers: base.map_markers,
        image_queries: Array.isArray(base.image_queries)
          ? base.image_queries.slice(0, 12)
          : undefined,
        photos: Array.isArray(base.photos) ? base.photos.slice(0, 4) : undefined,
        photo_attribution:
          typeof base.photo_attribution === "string"
            ? base.photo_attribution
            : undefined,
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

    // Log a compact view for Vercel
    console.log(
      `[plan ${reqId}] parsed summary slugs=`,
      summary.destinations.map((d) => d.slug)
    );
    console.log(
      `[plan ${reqId}] image_queries counts=`,
      parsed.destinations.map((d) => ({
        slug: d.slug,
        n: d.image_queries?.length || 0,
      }))
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
          toJsonb(d), // includes image_queries, photos, etc.
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
