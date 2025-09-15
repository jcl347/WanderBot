// app/results/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import CostComparisons from "@/components/CostComparisons";
import { mockPlan, mockDestinations } from "@/mocks/plan";
import { q } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let plan: any;
  let dests: any[] = [];

  if (useMock) {
    plan = {
      id: "demo",
      final_recommendation: mockPlan.final_recommendation,
      summary: mockPlan.summary,
    };
    dests = mockDestinations.map((d) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      analysis: null, // demo: you can extend mocks if you want
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();
    dests = await q<any>(
      `select slug, name, narrative, analysis
         from destinations
        where plan_id = $1
        order by name asc`,
      [id]
    );
  }

  const summary = plan.summary as {
    destinations: {
      name: string;
      slug: string;
      totalGroupUSD: number;
      avgPerPersonUSD: number;
    }[];
  };

  return (
    <BackgroundMap>
      <div className="flex items-center justify-between">
        <RobotBadge />
        <Link href="/" className="text-sm text-sky-700 underline">
          ← Start a new plan
        </Link>
      </div>

      <SectionCard>
        <h1 className="text-2xl font-semibold">Your trip plan</h1>
        <p className="mt-2 text-neutral-700 whitespace-pre-line">
          {plan.final_recommendation}
        </p>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-4">Cost comparison</h2>
        <CostComparisons data={summary.destinations} />
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Destinations</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {dests.map((d: any) => {
            const a = d.analysis || {};
            return (
              <Link
                key={d.slug}
                href={`/results/${useMock ? "demo" : id}/dest/${d.slug}`}
                className="rounded-xl border p-4 bg-gradient-to-br from-sky-50 to-emerald-50 hover:shadow-sm"
              >
                <div className="font-semibold text-sky-900">{d.name}</div>
                <div className="text-sm text-neutral-700 line-clamp-3 mb-2">
                  {d.narrative}
                </div>

                {/* fun extras if present */}
                {a.suggested_month && (
                  <div className="text-xs rounded bg-white/70 inline-block px-2 py-1 mr-2">
                    Suggested month: <b>{a.suggested_month}</b>
                  </div>
                )}
                {Array.isArray(a.satisfies) && a.satisfies.length > 0 && (
                  <div className="mt-2 text-xs text-neutral-700">
                    <b>Why your crew likes it:</b>{" "}
                    {a.satisfies
                      .slice(0, 3)
                      .map((s: any) => `${s.travelerName}: ${s.reason}`)
                      .join(" · ")}
                    {a.satisfies.length > 3 ? " · …" : ""}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
