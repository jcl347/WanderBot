// app/results/[id]/page.tsx  (SERVER component — no "use client")
import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import CostComparisons from "@/components/CostComparisons"; // <- ensure this filename matches
import { mockPlan, mockDestinations } from "@/mocks/plan";
import { q } from "@/lib/db";

export default async function ResultsPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let plan: any;
  let dests: Array<{ slug: string; name: string; narrative: string }> = [];

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
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();

    dests = await q<any>(
      "select slug, name, narrative from destinations where plan_id = $1 order by name asc",
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
      {/* Header strip */}
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
          {dests.map((d) => (
            <Link
              key={d.slug}
              href={`/results/${useMock ? "demo" : id}/dest/${d.slug}`}
              className="rounded-xl border p-4 bg-white/90 hover:shadow-sm"
            >
              <div className="font-medium">{d.name}</div>
              <div className="text-sm text-neutral-600 line-clamp-3">
                {d.narrative}
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
