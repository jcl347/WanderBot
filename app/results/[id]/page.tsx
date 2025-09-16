// app/results/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import CostComparisons from "@/components/CostComparisons";
import MapLeaflet from "@/components/MapLeaflet";
import DestinationCard from "@/components/DestinationCard";
import { mockPlan, mockDestinations } from "@/mocks/plan";
import { q } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

type DestRow = {
  slug: string;
  name: string;
  narrative: string;
  // Optional JSONB columns that may or may not exist depending on model/DB
  analysis?: any | null;
  months?: Array<{ month: string; note: string }> | null;
  per_traveler_fares?: Array<{
    travelerName: string;
    from: string;
    avgUSD: number;
    monthBreakdown?: Array<{ month: string; avgUSD: number }>;
  }> | null;
};

type SummaryShape = {
  destinations: {
    name: string;
    slug: string;
    totalGroupUSD: number;
    avgPerPersonUSD: number;
  }[];
};

// Fallback centers if the model/DB didn't provide any map_center
const FALLBACK_CENTERS: Record<string, { lat: number; lon: number }> = {
  lisbon: { lat: 38.7223, lon: -9.1393 },
  "mexico-city": { lat: 19.4326, lon: -99.1332 },
  montreal: { lat: 45.5017, lon: -73.5673 },
  "san-diego": { lat: 32.7157, lon: -117.1611 },
  honolulu: { lat: 21.3069, lon: -157.8583 },
};

const CARD_COLORS = [
  // gentle, first-page-friendly tints
  { from: "from-sky-50", to: "to-sky-100/60", chip: "bg-sky-100 text-sky-800" },
  { from: "from-teal-50", to: "to-teal-100/60", chip: "bg-teal-100 text-teal-800" },
  { from: "from-amber-50", to: "to-amber-100/60", chip: "bg-amber-100 text-amber-800" },
  { from: "from-rose-50", to: "to-rose-100/60", chip: "bg-rose-100 text-rose-800" },
  { from: "from-violet-50", to: "to-violet-100/60", chip: "bg-violet-100 text-violet-800" },
];

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  // --- Load plan + destinations ---
  let plan: any;
  let dests: DestRow[] = [];

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
      analysis: d, // mock carries map_center, etc.
      months: (d as any).months ?? null,
      per_traveler_fares: (d as any).per_traveler_fares ?? null,
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();

    // Bring back the optional JSON that details & cards may use.
    const rawDests = await q<any>(
      `
      select slug, name, narrative, months, per_traveler_fares, analysis
      from destinations
      where plan_id = $1
      order by name asc
      `,
      [id]
    );

    dests = rawDests.map((d: any) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      months: d.months ?? null,
      per_traveler_fares: d.per_traveler_fares ?? null,
      analysis: d.analysis ?? null,
    }));
  }

  const summary = (plan.summary ?? { destinations: [] }) as SummaryShape;

  // --- Build map markers with names + coordinates in label ---
  const markers = dests
    .map((d) => {
      const mc =
        d.analysis?.map_center ||
        (FALLBACK_CENTERS as any)[d.slug] ||
        null;
      if (!mc || typeof mc.lat !== "number" || typeof mc.lon !== "number") return null;

      const label = `${d.name} (${mc.lat.toFixed(2)}, ${mc.lon.toFixed(2)})`;
      return { position: [mc.lat, mc.lon] as [number, number], label };
    })
    .filter(Boolean) as { position: [number, number]; label: string }[];

  // Reasonable initial center
  const center: [number, number] =
    markers.length ? markers[0]!.position : [30, -30];

  return (
    <BackgroundMap>
      <div className="flex items-center justify-between">
        <RobotBadge />
        <Link href="/" className="text-sm text-sky-700 underline">
          ← Start a new plan
        </Link>
      </div>

      {/* Summary / Final recommendation */}
      <SectionCard>
        <h1 className="text-2xl font-semibold">Your trip plan</h1>
        <p className="mt-2 text-neutral-700 whitespace-pre-line">
          {plan.final_recommendation}
        </p>
      </SectionCard>

      {/* Cost comparison (chart renders its own legend) */}
      <SectionCard>
        <h2 className="text-lg font-semibold mb-4">Cost comparison</h2>
        <CostComparisons data={summary.destinations} />
        {/* 🔧 Removed the extra “chips” row that duplicated labels under the chart */}
      </SectionCard>

      {/* Map with labeled pins */}
      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Trip map</h2>
        <div className="h-72 w-full">
          <MapLeaflet center={center} zoom={2} markers={markers} />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Pins show candidate destinations for your timeframe.
        </p>
      </SectionCard>

      {/* Destination cards */}
      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Destinations</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {dests.map((d, i) => {
            // Keep card palette gentle and consistent with the home page
            const c = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <div
                key={d.slug}
                className={`rounded-2xl border p-0 bg-gradient-to-br ${c.from} ${c.to} shadow-sm hover:shadow-md transition-shadow`}
              >
                <DestinationCard
                  dest={{
                    // Only pass primitives/arrays that DestinationCard expects
                    slug: d.slug,
                    name: d.name,
                    narrative: d.narrative,
                    analysis: d.analysis ?? undefined, // may include highlights/best_month/etc.
                  }}
                  href={`/results/${useMock ? "demo" : id}/dest/${d.slug}`}
                />
              </div>
            );
          })}
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
