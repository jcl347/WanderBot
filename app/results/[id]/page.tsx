// app/results/[id]/page.tsx
import Link from "next/link";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import CostComparisons from "@/components/CostComparisons";
import MapLeaflet from "@/components/MapLeaflet";
import DestinationCard from "@/components/DestinationCard";
import { mockPlan, mockDestinations } from "@/mocks/plan";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: { id: string } };

type DestRow = {
  slug: string;
  name: string;
  narrative: string;
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

const CARD_COLORS = [
  { from: "from-sky-50", to: "to-sky-100/60" },
  { from: "from-teal-50", to: "to-teal-100/60" },
  { from: "from-amber-50", to: "to-amber-100/60" },
  { from: "from-rose-50", to: "to-rose-100/60" },
  { from: "from-violet-50", to: "to-violet-100/60" },
];

export default async function ResultsPage({ params }: PageProps) {
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  if (!id) {
    return (
      <BackgroundMap>
        <div className="mx-auto w-full max-w-[1320px] px-4 md:px-6">
          <div className="flex items-center justify-between mb-2">
            <RobotBadge />
            <Link href="/" className="text-sm text-sky-700 hover:underline">
              &larr; Start a new plan
            </Link>
          </div>
          <SectionCard>
            <h1 className="text-xl font-semibold">Missing plan id</h1>
            <p className="mt-2 text-neutral-700">
              We didn’t receive a plan id in the URL.
            </p>
          </SectionCard>
        </div>
      </BackgroundMap>
    );
  }

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let plan: any | null = null;
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
      analysis: d,
      months: (d as any).months ?? null,
      per_traveler_fares: (d as any).per_traveler_fares ?? null,
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0] ?? null;

    // If the row isn't there yet (race with /api/plan insert), show a soft fallback instead of 404
    if (!plan) {
      return (
        <BackgroundMap>
          <div className="mx-auto w-full max-w-[1320px] px-4 md:px-6">
            <div className="flex items-center justify-between mb-2">
              <RobotBadge />
              <Link href="/" className="text-sm text-sky-700 hover:underline">
                &larr; Start a new plan
              </Link>
            </div>
            <SectionCard>
              <h1 className="text-xl font-semibold">Preparing your plan…</h1>
              <p className="mt-2 text-neutral-700">
                We couldn’t find a plan for id{" "}
                <code className="font-mono">{id}</code> yet. This often means the
                save is still finishing. Try refreshing in a moment.
              </p>
            </SectionCard>
          </div>
        </BackgroundMap>
      );
    }

    const rawDests = await q<any>(
      `
      select slug, name, narrative, months, per_traveler_fares, analysis
      from destinations
      where plan_id = $1
      order by name asc
      `,
      [id]
    );

    dests = (rawDests || []).map((d: any) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      months: d.months ?? null,
      per_traveler_fares: d.per_traveler_fares ?? null,
      analysis: d.analysis ?? null,
    }));
  }

  const summary = (plan.summary ?? { destinations: [] }) as SummaryShape;

  // Build markers only from model-provided coordinates
  const markers = dests
    .map((d) => {
      const mc = d?.analysis?.map_center;
      if (!mc || typeof mc.lat !== "number" || typeof mc.lon !== "number") {
        console.warn("[results] missing map_center for slug:", d.slug);
        return null;
      }
      return {
        position: [mc.lat, mc.lon] as [number, number],
        label: `${d.name} (${mc.lat.toFixed(2)}, ${mc.lon.toFixed(2)})`,
      };
    })
    .filter(Boolean) as { position: [number, number]; label: string }[];

  const center: [number, number] = markers.length ? markers[0]!.position : [30, -30];

  console.log("[results] pins from model map_center:", markers.length, "of", dests.length);

  return (
    <BackgroundMap>
      <div className="mx-auto w-full max-w-[1320px] px-4 md:px-6">
        <div className="flex items-center justify-between mb-2">
          <RobotBadge />
          <Link href="/" className="text-sm text-sky-700 hover:underline">
            &larr; Start a new plan
          </Link>
        </div>

        <SectionCard>
          <h1 className="text-2xl font-semibold">Your trip plan</h1>
          <p className="mt-2 text-neutral-700 whitespace-pre-line leading-relaxed">
            {plan.final_recommendation}
          </p>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-semibold mb-4">Cost comparison</h2>
          <CostComparisons data={summary.destinations} />
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-semibold mb-3">Trip map</h2>
          <div className="h-80 w-full">
            <MapLeaflet center={center} zoom={2} markers={markers} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Pins show candidate destinations for your timeframe.
          </p>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-semibold mb-3">Destinations</h2>
          <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-8">
            {dests.map((d, i) => {
              const c = CARD_COLORS[i % CARD_COLORS.length];
              return (
                <div
                  key={d.slug}
                  className={`rounded-2xl border p-0 bg-gradient-to-br ${c.from} ${c.to} shadow-md hover:shadow-lg transition-shadow`}
                >
                  <DestinationCard
                    dest={{
                      slug: d.slug,
                      name: d.name,
                      narrative: d.narrative,
                      analysis: d.analysis ?? undefined,
                    }}
                    href={`/results/${useMock ? "demo" : id}/dest/${d.slug}`}
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </BackgroundMap>
  );
}
