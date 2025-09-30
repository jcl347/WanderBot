// app/results/[id]/dest/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import RobotBadge from "@/components/RobotBadge";
import DestDetailClient from "@/components/DestDetailClient";
import { q } from "@/lib/db";
import { mockDestinationDetailBySlug } from "@/mocks/destinations";

type PageProps = { params: Promise<{ id: string; slug: string }> };

export default async function DestDetail({ params }: PageProps) {
  const { id, slug } = await params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  // ------- DB path -------
  if (!useMock) {
    const rows = await q<any>(
      `
      select slug, name, narrative, months, per_traveler_fares, analysis
      from destinations
      where plan_id = $1 and slug = $2
      limit 1
    `,
      [id, slug]
    );

    const dest = rows?.[0];
    if (!dest) return notFound();

    return (
      <BackgroundMap>
        {/* Top bar aligned with the center column width */}
        <div className="mx-auto w-full max-w-[840px] px-4 md:px-0">
          <div className="flex items-center justify-between mb-2">
            <RobotBadge />
            <Link
              href={`/results/${id}`}
              className="text-sm text-sky-700 hover:underline"
            >
              &larr; Back to results
            </Link>
          </div>
        </div>

        {/* DestDetailClient reads photos / image queries / map_* from dest.analysis */}
        <DestDetailClient dest={dest} />
      </BackgroundMap>
    );
  }

  // ------- Mock path -------
  const dest = (mockDestinationDetailBySlug as Record<string, any>)[slug];
  if (!dest) return notFound();

  return (
    <BackgroundMap>
      {/* Top bar aligned with the center column width */}
      <div className="mx-auto w-full max-w-[840px] px-4 md:px-0">
        <div className="flex items-center justify-between mb-2">
          <RobotBadge />
          <Link
            href={`/results/${id}`}
            className="text-sm text-sky-700 hover:underline"
          >
            &larr; Back to results
          </Link>
        </div>
      </div>

      <DestDetailClient dest={dest} />
    </BackgroundMap>
  );
}
