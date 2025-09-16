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

type PageProps = { params: Promise<{ id: string }> };

// fallback lat/lon for demo slugs if model/DB didn’t provide map_center
const FALLBACK_CENTERS: Record<string, { lat: number; lon: number }> = {
  lisbon: { lat: 38.7223, lon: -9.1393 },
  "mexico-city": { lat: 19.4326, lon: -99.1332 },
  montreal: { lat: 45.5017, lon: -73.5673 },
  "san-diego": { lat: 32.7157, lon: -117.1611 },
  honolulu: { lat: 21.3069, lon: -157.8583 },
};

export default async function ResultsPage({ params }: PageProps) {
  const { id } = await params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let plan: any;
  let dests: Array<{
    slug: string;
    name: string;
    narrative: string;
    map_center?: { lat: number; lon: number } | null;
  }> = [];

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
      map_center: FALLBACK_CENTERS[d.slug as keyof typeof FALLBACK_CENTERS],
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();

    // try to pull map_center if your route stored it in analysis (jsonb)
    dests = await q<any>(
      `select slug, name, narrative, analysis
       from destinations
       where plan_id = $1
       order by name asc`,
      [id]
    );
    dests = dests.map((d: any) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      map_center: d.analysis?.map_center ?? null,
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
        d.map_center ?? FALLBACK_CENTERS[d.slug as keyof typeof FALLBACK_CENTERS];
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
        <p className="mt-2 whitespace-pre-line text-neutral-700">
          {plan.final_recommendation}
        </p>
      </SectionCard>

      <SectionCard>
        <h2 className="mb-4 text-lg font-semibold">Cost comparison</h2>
        <CostComparisons data={summary.destinations} />
      </SectionCard>

      <SectionCard>
        <h2 className="mb-3 text-lg font-semibold">Trip map</h2>
        <div className="h-72 w-full">
          <MapLeaflet center={center} zoom={2} markers={markers} />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Pins show candidate destinations for your timeframe.
        </p>
      </SectionCard>

      <SectionCard>
        <h2 className="mb-3 text-lg font-semibold">Destinations</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {dests.map((d) => {
            const palette = [
              "from-sky-50 to-sky-100 border-sky-200",
              "from-emerald-50 to-emerald-100 border-emerald-200",
              "from-amber-50 to-amber-100 border-amber-200",
              "from-violet-50 to-violet-100 border-violet-200",
              "from-rose-50 to-rose-100 border-rose-200",
            ];
            const idx =
              Math.abs(
                d.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
              ) % palette.length;

            return (
              <Link
                key={d.slug}
                href={`/results/${useMock ? "demo" : id}/dest/${d.slug}`}
                className={`rounded-xl border p-4 bg-gradient-to-br ${palette[idx]} transition hover:shadow-md`}
              >
                <div className="font-semibold">{d.name}</div>
                <div className="mt-1 line-clamp-3 text-sm text-neutral-700">
                  {d.narrative}
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
