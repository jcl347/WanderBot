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

type ListDest = {
  slug: string;
  name: string;
  narrative: string;
  analysis: any; // normalized to an object in both mock & DB paths
  map_center?: { lat: number; lon: number } | null;
  per_traveler_fares?: Array<{
    travelerName: string;
    from: string;
    avgUSD: number;
    monthBreakdown?: { month: string; avgUSD: number }[];
  }>;
};

// Shape returned by DB query (use COALESCE to avoid nulls)
type DbRow = {
  slug: string;
  name: string;
  narrative: string;
  analysis: any; // jsonb object
  per_traveler_fares: ListDest["per_traveler_fares"];
};

// Fallback lat/lon for demo slugs if model/DB didn’t provide map_center
const FALLBACK_CENTERS: Record<string, { lat: number; lon: number }> = {
  lisbon: { lat: 38.7223, lon: -9.1393 },
  "mexico-city": { lat: 19.4326, lon: -99.1332 },
  montreal: { lat: 45.5017, lon: -73.5673 },
  "san-diego": { lat: 32.7157, lon: -117.1611 },
  honolulu: { lat: 21.3069, lon: -157.8583 },
};

// Soft brand palette variants (sky/emerald/indigo/amber/rose)
const CARD_TINTS = [
  { bg: "bg-sky-50/70", ring: "ring-sky-200" },
  { bg: "bg-emerald-50/70", ring: "ring-emerald-200" },
  { bg: "bg-indigo-50/70", ring: "ring-indigo-200" },
  { bg: "bg-amber-50/70", ring: "ring-amber-200" },
  { bg: "bg-rose-50/70", ring: "ring-rose-200" },
];

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let plan: any;
  let dests: ListDest[] = [];

  if (useMock) {
    // Mock plan + destinations for demo path
    plan = {
      id: "demo",
      final_recommendation: mockPlan.final_recommendation,
      summary: mockPlan.summary,
    };
    dests = mockDestinations.map((d) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      analysis: d.analysis ?? {},
      map_center: FALLBACK_CENTERS[d.slug as keyof typeof FALLBACK_CENTERS] ?? null,
      per_traveler_fares: d.per_traveler_fares ?? [],
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();

    // Ensure analysis is always an object for TS via COALESCE
    const rawDests = await q<DbRow>(
      `
      select
        slug,
        name,
        narrative,
        coalesce(analysis, '{}'::jsonb) as analysis,
        coalesce(per_traveler_fares, '[]'::jsonb) as per_traveler_fares
      from destinations
      where plan_id = $1
      order by name asc
      `,
      [id]
    );

    dests = rawDests.map((d) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      analysis: d.analysis, // guaranteed object
      map_center: d.analysis?.map_center ?? null,
      per_traveler_fares: d.per_traveler_fares ?? [],
    }));
  }

  const summary = plan.summary as {
    destinations: {
      name: string;
      slug: string;
      totalGroupUSD: number;
      avgPerPersonUSD: number;
    }[];
  };

  // Build markers for map
  const markers = dests
    .map((d) => {
      const mc =
        d.map_center ??
        FALLBACK_CENTERS[d.slug as keyof typeof FALLBACK_CENTERS];
      if (!mc) return null;
      return { position: [mc.lat, mc.lon] as [number, number], label: d.name };
    })
    .filter(Boolean) as { position: [number, number]; label: string }[];

  // Choose a reasonable center: first marker or Atlantic view
  const center: [number, number] =
    markers.length > 0 ? markers[0]!.position : [30, -30];

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
        {/* Soft brand-tinted legend chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.destinations.map((d, i) => {
            const tint = CARD_TINTS[i % CARD_TINTS.length];
            return (
              <span
                key={d.slug}
                className={`inline-flex items-center gap-2 rounded-full ${tint.bg} ring-1 ${tint.ring} px-3 py-1 text-xs`}
                title={`${d.name}: group $${d.totalGroupUSD.toLocaleString()}, per person $${d.avgPerPersonUSD.toLocaleString()}`}
              >
                <span className="h-2 w-2 rounded-full bg-black/70" />
                {d.name}
              </span>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Trip map</h2>
        <div className="h-72 w-full">
          <MapLeaflet center={center} zoom={2} markers={markers} />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Pins show candidate destinations for your timeframe.
        </p>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Destinations</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {dests.map((d, idx) => {
            const tint = CARD_TINTS[idx % CARD_TINTS.length];
            return (
              <div
                key={d.slug}
                className={`rounded-2xl ${tint.bg} ring-1 ${tint.ring} p-0.5`}
              >
                <DestinationCard
                  dest={d}
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
