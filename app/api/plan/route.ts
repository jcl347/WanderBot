// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import OpenAI from "openai";

export const runtime = "nodejs"; // use Node runtime so 'pg' works

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

// ---------- model output schema ----------
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

const MODEL = "gpt-5";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ---------- prompt ----------
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
You're a group vacation planner. Create exactly 5 destination candidates and cost analysis.

TRAVELERS
${tableHeader}${rows}

TIMEFRAME: ${timeframe.startMonth} → ${timeframe.endMonth}
USER IDEAS: ${suggestions?.trim() || "none"}

Rules:
- If any traveler says "dislikes travel", center trip near their home (${anchor}).
- Otherwise, optimize for minimized total group flight cost while balancing interests (families, kids).
- For each destination, provide:
  narrative (why it fits each person + tiny plan),
  per_traveler_fares: list of average round-trip economy prices (USD) per traveler (home → destination),
  months: short notes for months within timeframe about price/season.

Output ONLY JSON per schema. No extra prose.
`.trim();
}

// ---------- handler ----------
export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const prompt = buildPrompt(body);

    const resp = await openai.responses.create({
      model: MODEL,
      input: prompt,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "GroupPlan",
          schema: {
            type: "object",
            properties: {
              final_recommendation: { type: "string" },
              destinations: {
                type: "array",
                minItems: 5,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    slug: { type: "string" },
                    narrative: { type: "string" },
                    months: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          month: { type: "string" },
                          note: { type: "string" },
                        },
                        required: ["month", "note"],
                      },
                    },
                    per_traveler_fares: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          travelerName: { type: "string" },
                          from: { type: "string" },
                          avgUSD: { type: "number" },
                          monthBreakdown: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                month: { type: "string" },
                                avgUSD: { type: "number" },
                              },
                              required: ["month", "avgUSD"],
                            },
                          },
                        },
                        required: ["travelerName", "from", "avgUSD"],
                      },
                    },
                  },
                  required: ["name", "slug", "narrative", "per_traveler_fares"],
                },
              },
            },
            required: ["final_recommendation", "destinations"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = resp.output_text ?? "{}";
    const parsed = PlanSchema.parse(JSON.parse(raw));

    // compute totals
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

    // persist plan
    const [plan] = await q<{ id: string }>(
      `
      insert into plans (timeframe, travelers, suggestions, model, final_recommendation, summary)
      values ($1,$2,$3,$4,$5,$6) returning id
    `,
      [
        body.timeframe,
        body.travelers,
        body.suggestions ?? null,
        MODEL,
        parsed.final_recommendation,
        summary,
      ]
    );

    // persist destinations
    for (const d of parsed.destinations) {
      await q(
        `
        insert into destinations (plan_id, slug, name, narrative, months, per_traveler_fares, totals)
        values ($1,$2,$3,$4,$5,$6, jsonb_build_object('avgPerPerson',0,'totalGroup',0))
      `,
        [
          plan.id,
          d.slug,
          d.name,
          d.narrative,
          d.months ?? [],
          JSON.stringify(d.per_traveler_fares),
        ]
      );
    }

    return NextResponse.json({ planId: plan.id });
  } catch (err: any) {
    console.error(err);
    const message =
      typeof err?.message === "string" ? err.message : "error";
    return new NextResponse(message, { status: 400 });
  }
}
