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

// Fallback lat/lon if a dest has no map_center in analysis
const FALLBACK_CENTERS: Record<string, { lat: number; lon: number }> = {
  lisbon: { lat: 38.7223, lon: -9.1393 },
  "mexico-city": { lat: 19.4326, lon: -99.1332 },
  montreal: { lat: 45.5017, lon: -73.5673 },
  "san-diego": { lat: 32.7157, lon: -117.1611 },
  honolulu: { lat: 21.3069, lon: -157.8583 },
};

// Soft, brand-aligned variants (very light gradients + matching borders)
// The card style will rotate through these based on slug hash.
const CARD_VARIANTS = [
  { grad: "from-sky-50 to-white", border: "border-sky-200", title: "text-sky-900" },
  { grad: "from-emerald-50 to-white", border: "border-emerald-200", title: "text-emerald-900" },
  { grad: "from-indigo-50 to-white", border: "border-indigo-200", title: "text-indigo-900" },
  { grad: "from-amber-50 to-white", border: "border-amber-200", title: "text-amber-900" },
  { grad: "from-rose-50 to-white", border: "border-rose-200", title: "text-rose-900" },
];

// Simple deterministic hash so the same slug always gets the same soft color
function slugIndex(slug: string, mod = CARD_VARIANTS.length) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % mod;
}

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
    months?: any[];
    per_traveler_fares?: any[];
    analysis?: any;
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
      months: d.months,
      per_traveler_fares: d.per_traveler_fares,
      analysis: d.analysis,
      map_center: FALLBACK_CENTERS[d.slug as keyof typeof FALLBACK_CENTERS],
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();

    // Pull the extra fields the detail page expects
    dests = await q<any>(
      `select slug, name, narrative, months, per_traveler_fares, analysis
       from destinations
       where plan_id = $1
       order by name asc`,
      [id]
    );

    dests = dests.map((d: any) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
      months: d.months,
      per_traveler_fares: d.per_traveler_fares,
      analysis: d.analysis,
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

  // Build markers for the overview map
  const markers = dests
    .map((d) => {
      const mc =
        d.map_center ??
        FALLBACK_CENTERS[d.slug as keyof typeof FALLBACK_CENTERS];
      if (!mc) return null;
      return {
        position: [mc.lat, mc.lon] as [number, number],
        label: d.name,
      };
    })
    .filter(Boolean) as { position: [number, number]; label: string }[];

  // Pick a reasonable center
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
            const idx = slugIndex(d.slug);
            const v = CARD_VARIANTS[idx];

            return (
              <Link
                key={d.slug}
                href={`/results/${useMock ? "demo" : id}/dest/${d.slug}`}
                className={[
                  "rounded-2xl border p-4 shadow-sm transition hover:shadow-md",
                  "bg-gradient-to-br",
                  v.grad,
                  v.border,
                ].join(" ")}
              >
                <div className={`font-semibold ${v.title}`}>{d.name}</div>
                <div className="mt-1 line-clamp-3 text-sm text-neutral-700">
                  {d.narrative}
                </div>

                {/* Small hint row */}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {Array.isArray(d.months) && d.months.length > 0 && (
                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-neutral-700 border">
                      📅 {d.months[0].month}
                    </span>
                  )}
                  {Array.isArray(d.per_traveler_fares) &&
                    d.per_traveler_fares.length > 0 && (
                      <span className="rounded-full bg-white/60 px-2 py-0.5 text-neutral-700 border">
                        💸 Avg ${Math.round(
                          d.per_traveler_fares.reduce(
                            (a: number, f: any) => a + (Number(f.avgUSD) || 0),
                            0
                          ) / d.per_traveler_fares.length
                        ).toLocaleString()}
                      </span>
                    )}
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
