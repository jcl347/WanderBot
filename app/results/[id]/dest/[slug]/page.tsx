import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import DestDetailClient from "@/components/DestDetailClient";
import { mockDestinationDetailBySlug } from "@/mocks/destinations";
import { q } from "@/lib/db";

type PageParams = Promise<{ id: string; slug: string }>;

export default async function DestDetail({ params }: { params: PageParams }) {
  const { id, slug } = await params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let dest: any;

  if (useMock) {
    dest = mockDestinationDetailBySlug[slug];
  } else {
    const rows = await q<any>(
      "select slug, name, narrative, months, per_traveler_fares, analysis, map_center, best_month, avoid_months from destinations where plan_id = $1 and slug = $2",
      [id, slug]
    );
    dest = rows?.[0];
  }

  if (!dest) return notFound();

  // Flatten some fields for the client component
  const shaped = {
    ...dest,
    photos: dest.analysis?.photos ?? dest.highlights?.filter((h: any) => typeof h === "string") ?? undefined,
    best_month: dest.best_month ?? dest.analysis?.best_month,
    map_center: dest.map_center,
  };

  return (
    <BackgroundMap>
      <div className="flex items-center justify-between">
        <RobotBadge />
        <Link href={`/results/${id}`} className="text-sm text-sky-700 underline">
          ← Back to results
        </Link>
      </div>

      <DestDetailClient dest={shaped} />
    </BackgroundMap>
  );
}
