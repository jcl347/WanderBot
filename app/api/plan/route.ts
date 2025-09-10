// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import OpenAI from "openai";
import { parse as partialJsonParse } from "partial-json";

export const runtime = "nodejs"; // required for 'pg' (no edge)

// ---------- helpers ----------
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // override in env if you have gpt-5
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// stringify + null-safe
const toJsonb = (v: unknown) => JSON.stringify(v ?? null);

// safe, short log
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
const PlanSchema = z.object({
  final_recommendation: z.string(),
  destinations: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string(),
        narrative: z.string(),
        months: z
          .array(z.object({ month: z.string(), note: z.string() }))
          .optional(),
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
You're a travel analyst for indecisive group trips. Produce **exactly 5 destination candidates** with clear, defensible reasoning and airfare estimates.

TRAVELERS
${tableHeader}${rows}

TIMEFRAME: ${timeframe.startMonth} → ${timeframe.endMonth}
USER IDEAS: ${suggestions?.trim() || "none"}

Rules:
- If ANY traveler includes the phrase "dislikes travel", **center the trip near their home** (${anchor}).
- Otherwise, **minimize total group flight cost** while balancing interests (families, kids, mobility, vibes).
- For each destination:
  - "narrative": WHY it fits the group (reference specific people/needs) + a tiny 2–3 bullet micro-itinerary.
  - "per_traveler_fares": average round-trip economy (USD) from each person’s home to destination.
  - Optionally provide "months" notes inside the timeframe (price/seasonality).
- After listing 5, choose ONE BEST overall pick and explain WHY it’s best in **final_recommendation** (cost + fit tradeoffs).

Output **ONLY JSON** matching this schema (no extra text, no Markdown):
{
  "final_recommendation": string,
  "destinations": [
    {
      "name": string,
      "slug": string,              // url-friendly, e.g. "mexico-city"
      "narrative": string,         // opinionated mini-brief
      "months"?: [{ "month": "YYYY-MM", "note": string }],
      "per_traveler_fares": [
        {
          "travelerName": string,
          "from": string,
          "avgUSD": number,
          "monthBreakdown"?: [{ "month": "YYYY-MM", "avgUSD": number }]
        }
      ]
    }
  ] // exactly 5
}
`.trim();
}

// ---------- route ----------
export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8); // tiny correlation id for logs
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const rawBody = await req.json();
    console.log(`[plan ${reqId}] Incoming body keys:`, Object.keys(rawBody || {}));

    // Validate input
    let body: z.infer<typeof Body>;
    try {
      body = Body.parse(rawBody);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod body validation error:`, e?.errors || e);
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const prompt = buildPrompt(body);
    console.log(
      `[plan ${reqId}] Model: ${MODEL} | Prompt length: ${prompt.length} chars\n` +
      `[plan ${reqId}] Prompt head:\n${short(prompt)}`
    );

    // Ask OpenAI (JSON enforced)
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

    // Strict parse then fallback to partial
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn(`[plan ${reqId}] Strict parse failed; attempting partial-json parse`);
      json = partialJsonParse(raw);
    }

    // Normalize slugs just in case
    if (
      typeof json === "object" &&
      json !== null &&
      Array.isArray((json as any).destinations)
    ) {
      (json as any).destinations = (json as any).destinations.map((d: any) => ({
        ...d,
        slug: d?.slug ? slugify(String(d.slug)) : slugify(String(d?.name ?? "")),
      }));
    }

    // Validate model output
    let parsed: z.infer<typeof PlanSchema>;
    try {
      parsed = PlanSchema.parse(json);
    } catch (e: any) {
      console.error(`[plan ${reqId}] Zod output validation error:`, e?.errors || e);
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

    // Sanity log before DB
    console.log(`[plan ${reqId}] Saving plan:`, {
      timeframe: body.timeframe,
      travelersCount: body.travelers.length,
      destinations: summary.destinations.map((d) => d.slug),
    });

    // Save plan (JSONB casts)
    const [plan] = await q<{ id: string }>(
      `
      INSERT INTO plans
        (timeframe, travelers, suggestions, model, final_recommendation, summary)
      VALUES
        ($1::jsonb, $2::jsonb, $3, $4, $5, $6::jsonb)
      RETURNING id
    `,
      [
        toJsonb(body.timeframe),
        toJsonb(body.travelers),
        body.suggestions ?? null,
        MODEL,
        parsed.final_recommendation,
        toJsonb(summary),
      ]
    );

    // Save destinations (JSONB casts)
    for (const d of parsed.destinations) {
      await q(
        `
        INSERT INTO destinations
          (plan_id, slug, name, narrative, months, per_traveler_fares, totals)
        VALUES
          ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
      `,
        [
          plan.id,
          d.slug,
          d.name,
          d.narrative,
          toJsonb(d.months ?? []),
          toJsonb(d.per_traveler_fares),
          toJsonb({ avgPerPerson: 0, totalGroup: 0 }),
        ]
      );
    }

    console.log(`[plan ${reqId}] Done. planId=${plan.id}`);
    return NextResponse.json({ planId: plan.id });
  } catch (err: any) {
    // Everything important shows in Vercel logs
    const payload = err?.response?.data ?? err;
    console.error("[/api/plan] Fatal:", payload);
    const msg =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Unknown error";
    return new NextResponse(msg, { status: 400 });
  }
}
