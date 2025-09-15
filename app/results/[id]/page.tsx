// app/results/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import CostComparisons from "@/components/CostComparisons";
import MapLeaflet from "@/components/MapLeaflet";
import { mockPlan, mockDestinations } from "@/mocks/plan";
import { q } from "@/lib/db";

type PageParams = Promise<{ id: string }>;

const DEMO_CENTER: Record<string, [number, number]> = {
  lisbon: [38.72, -9.14],
  "mexico-city": [19.43, -99.13],
  montreal: [45.50, -73.57],
  "san-diego": [32.72, -117.16],
  honolulu: [21.30, -157.85],
};

export default async function ResultsPage({ params }: { params: PageParams }) {
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
      group_fit: { summary: "Balanced for costs and convenience." },
    };
    dests = mockDestinations.map((d) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      analysis: { map_center: { lat: DEMO_CENTER[d.slug]?.[0] ?? 30, lon: DEMO_CENTER[d.slug]?.[1] ?? -30 } },
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();

    dests = await q<any>(
      "select slug, name, narrative, analysis, map_center from destinations where plan_id = $1 order by name asc",
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

  // Build markers for overview map
  const markers = dests
    .map((d) => {
      const c = d.map_center ?? d.analysis?.map_center;
      if (!c?.lat || !c?.lon) return null;
      return { position: [c.lat, c.lon] as [number, number], label: d.name };
    })
    .filter(Boolean) as { position: [number, number]; label: string }[];

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
        {plan.group_fit?.summary && (
          <p className="mt-2 text-neutral-700">
            <span className="font-medium">Why this fits your group: </span>
            {plan.group_fit.summary}
          </p>
        )}
        <p className="mt-2 text-neutral-700 whitespace-pre-line">
          {plan.final_recommendation}
        </p>
      </SectionCard>

      {/* Overview map of all destination centers */}
      {markers.length > 0 && (
        <SectionCard>
          <h2 className="text-lg font-semibold mb-3">Where these picks are</h2>
          <div className="h-64">
            <MapLeaflet center={markers[0].position} zoom={markers.length > 1 ? 2 : 8} markers={markers} />
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <h2 className="text-lg font-semibold mb-4">Cost comparison</h2>
        <CostComparisons data={summary.destinations} />
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Destinations</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {dests.map((d: any, i: number) => {
            const chipColors = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa"];
            const band = chipColors[i % chipColors.length];
            return (
              <Link
                key={d.slug}
                href={`/results/${useMock ? "demo" : id}/dest/${d.slug}`}
                className="rounded-xl border bg-white/90 hover:shadow-sm overflow-hidden"
              >
                <div className="h-1 w-full" style={{ backgroundColor: band }} />
                <div className="p-4">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-neutral-600 line-clamp-3">{d.narrative}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
