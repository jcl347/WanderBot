// app/results/[id]/dest/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import DestDetailClient from "@/components/DestDetailClient";
import { mockDestinationDetailBySlug } from "@/mocks/destinations";
import { q } from "@/lib/db";

type PageProps = { params: Promise<{ id: string; slug: string }> };

export default async function DestDetail({ params }: PageProps) {
  const { id, slug } = await params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let dest: any;

  if (useMock) {
    dest = mockDestinationDetailBySlug[slug];
    if (!dest) return notFound();
  } else {
    const rows = await q<any>(
      `select slug, name, narrative, months, per_traveler_fares, analysis
         from destinations
        where plan_id = $1 and slug = $2
        limit 1`,
      [id, slug]
    );
    dest = rows?.[0];
    if (!dest) return notFound();

    // merge analysis convenience (map_center, suggested_month, etc.)
    const a = dest.analysis || {};
    dest = {
      ...dest,
      ...a,
      // keep original fields
      months: dest.months || a.months || [],
      per_traveler_fares: dest.per_traveler_fares || a.per_traveler_fares || [],
    };
  }

  return (
    <BackgroundMap>
      <div className="flex items-center justify-between">
        <RobotBadge />
        <Link href={`/results/${id}`} className="text-sm text-sky-700 underline">
          ← Back to results
        </Link>
      </div>

      {/* client component renders charts + leaflet */}
      <DestDetailClient dest={dest} />

      {/* cute footer card */}
      <SectionCard tight>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖🎒</span>
          <p className="text-sm text-neutral-700">
            Our vacationing robot approves this spot — and is already practicing a beach shuffle.
          </p>
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
