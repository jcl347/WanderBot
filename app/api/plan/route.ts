// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import OpenAI from "openai";
import { parse as partialJsonParse } from "partial-json";

export const runtime = "nodejs";

// ---------- helpers ----------
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const toJsonb = (v: unknown) => JSON.stringify(v ?? null);
const short = (s: string, n = 400) =>
  (s || "").slice(0, n) + ((s || "").length > n ? " …[truncated]" : "");

// ---------- input validation ----------
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

// ---------- model output validation ----------
const Geo = z.object({ lat: z.number(), lon: z.number() });

const PlanSchema = z.object({
  // new: high-level fit summary we’ll show on /results/[id]
  group_fit: z
    .object({
      summary: z.string(),
    })
    .optional(),

  final_recommendation: z.string(),

  destinations: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string(),
        narrative: z.string(),

        months: z.array(z.object({ month: z.string(), note: z.string() })).optional(),
        per_traveler_fares: z.array(
          z.object({
            travelerName: z.string(),
            from: z.string(),
            avgUSD: z.number(),
            monthBreakdown: z
              .array(z.object({ month: z.string(), avgUSD: z.number() }))
              .optional(),
          })
        ),

        // NEW: enrichments for maps & photos
        suggested_month: z.string().optional(),
        seasonal_warnings: z.array(z.object({ month: z.string(), note: z.string() })).optional(),
        satisfies: z.array(z.object({ travelerName: z.string(), reason: z.string() })).optional(),
        analytics: z
          .object({
            avgUSD: z.number().optional(),
            varianceUSD: z.number().optional(),
            cheapestMonth: z.string().optional(),
            mostExpensiveMonth: z.string().optional(),
          })
          .optional(),

        map_center: Geo.optional(),
        map_markers: z
          .array(
            z.object({
              name: z.string(),
              position: z.tuple([z.number(), z.number()]), // [lat, lon]
              blurb: z.string().optional(),
            })
          )
          .optional(),

        photos: z.array(z.string()).optional(), // direct https image URLs (jpg/png)
        photo_attribution: z.string().optional(),
      })
    )
    .length(5),
});

// ---------- prompt ----------
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

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

  return `
You're a travel analyst for indecisive group trips. Produce **exactly 5 destinations** with opinionated reasoning and airfare estimates.

TRAVELERS
${tableHeader}${rows}

TIMEFRAME: ${timeframe.startMonth} → ${timeframe.endMonth}
USER IDEAS: ${suggestions?.trim() || "none"}

Rules:
- If ANY traveler includes "dislikes travel", **center the trip near their home** (${anchor}).
- Otherwise, **minimize total group flight cost** while balancing interests (families, kids, mobility, vibes).

FOR EACH DESTINATION, RETURN:
1) "narrative": WHY it fits the group (reference specific people/needs) + tiny 2–3 bullet micro-itinerary.
2) "per_traveler_fares": average round-trip economy (USD) from each person’s home to the destination.
3) Optional "months": notes inside the timeframe about price/seasonality.
4) **MAP DATA**:
   - "map_center": approximate city center {lat, lon}.
   - "map_markers": 4–6 iconic POIs with { name, position:[lat, lon], blurb }.
5) **PHOTOS**:
   - "photos": 4–6 **direct HTTPS image URLs** (jpg/jpeg/png) for the POIs or skyline.
     Prefer Wikimedia Commons, Wikipedia, or other CC/public-domain sources.
     Avoid trackers and redirects. Links should end with the image file extension when possible.
   - "photo_attribution": short attribution text, if relevant.
6) Optional analysis like:
   - "satisfies": [{ travelerName, reason }], "suggested_month", "seasonal_warnings",
     "analytics": { avgUSD, varianceUSD, cheapestMonth, mostExpensiveMonth }.

ALSO RETURN:
- "group_fit": { "summary": short paragraph explaining what this group seems to want and how the picks balance that. }
- "final_recommendation": the single best pick with short reasoning (cost + fit tradeoffs).

Output **ONLY JSON** matching this schema (no extra text, no Markdown).
`.trim();
}

// ---------- route ----------
export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const rawBody = await req.json();
    console.log(`[plan ${reqId}] Incoming body keys:`, Object.keys(rawBody || {}));

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

    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You produce strict JSON that matches the spec." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[plan ${reqId}] OpenAI raw head:\n${short(raw)}`);
    if (!raw) throw new Error("OpenAI returned empty content");

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn(`[plan ${reqId}] Strict parse failed; attempting partial-json parse`);
      json = partialJsonParse(raw);
    }

    // Normalize slugs
    if (json && typeof json === "object" && Array.isArray((json as any).destinations)) {
      (json as any).destinations = (json as any).destinations.map((d: any) => ({
        ...d,
        slug: d?.slug ? slugify(String(d.slug)) : slugify(String(d?.name ?? "")),
      }));
    }

    let parsed: z.infer<typeof PlanSchema>;
    try {
      parsed = PlanSchema.parse(json);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod output validation error:`, e?.errors || e);
      console.error(`[plan ${reqId}] Raw model output:\n${short(JSON.stringify(json || {}), 1200)}`);
      return new NextResponse("Model output did not match schema", { status: 400 });
    }

    // Compute totals
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

    // Save plan (store full model output under model_output; include group_fit)
    const [plan] = await q<{ id: string }>(
      `
      INSERT INTO plans
        (timeframe, travelers, suggestions, model, final_recommendation, summary, group_fit, model_output)
      VALUES
        ($1::jsonb, $2::jsonb, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
      RETURNING id
    `,
      [
        toJsonb(body.timeframe),
        toJsonb(body.travelers),
        body.suggestions ?? null,
        MODEL,
        parsed.final_recommendation,
        toJsonb(summary),
        toJsonb(parsed.group_fit ?? { summary: "Balanced for costs and convenience." }),
        toJsonb(parsed),
      ]
    );

    // Save destinations (analysis packs all enrichments)
    for (const d of parsed.destinations) {
      const matched = summary.destinations.find((s) => s.slug === d.slug);
      const totals = {
        avgPerPerson: matched?.avgPerPersonUSD ?? null,
        totalGroup: matched?.totalGroupUSD ?? null,
      };

      const analysis = {
        satisfies: d.satisfies ?? null,
        suggested_month: d.suggested_month ?? null,
        seasonal_warnings: d.seasonal_warnings ?? null,
        analytics: d.analytics ?? null,
        photos: d.photos ?? null,
        photo_attribution: d.photo_attribution ?? null,
        map_center: d.map_center ?? null,
        map_markers: d.map_markers ?? null,
      };

      await q(
        `
        INSERT INTO destinations
          (plan_id, slug, name, narrative, months, per_traveler_fares, totals, analysis, map_center)
        VALUES
          ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
      `,
        [
          plan.id,
          d.slug,
          d.name,
          d.narrative,
          toJsonb(d.months ?? []),
          toJsonb(d.per_traveler_fares),
          toJsonb(totals),
          toJsonb(analysis),
          toJsonb(d.map_center ?? null),
        ]
      );
    }

    console.log(`[plan ${reqId}] Done. planId=${plan.id}`);
    return NextResponse.json({ planId: plan.id });
  } catch (err: any) {
    const payload = err?.response?.data ?? err;
    console.error("[/api/plan] Fatal:", payload);
    const msg =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Unknown error";
    return new NextResponse(msg, { status: 400 });
  }
}
