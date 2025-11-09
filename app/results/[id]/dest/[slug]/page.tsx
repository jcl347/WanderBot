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

  async function getDestFromDB() {
    const rows = await q<any>(
      `
      select slug, name, narrative, months, per_traveler_fares, analysis
      from destinations
      where plan_id = $1 and slug = $2
      limit 1
      `,
      [id, slug]
    );
    return rows?.[0];
  }

  const dest = useMock
    ? (mockDestinationDetailBySlug as Record<string, any>)[slug]
    : await getDestFromDB();

  if (!dest) return notFound();

  return (
    <BackgroundMap>
      {/* Sticky breadcrumb aligned to the same centered width as content */}
      <div className="sticky top-16 z-30 bg-transparent">
        <div className="mx-auto w-full max-w-[1200px] px-6">
          <div className="flex items-center justify-between py-2">
            <Link
              href={`/results/${id}`}
              className="inline-flex items-center gap-2 text-sm text-sky-700 hover:text-sky-800"
            >
              <span aria-hidden>←</span>
              <span>Back to results</span>
            </Link>
            <RobotBadge />
          </div>
        </div>
      </div>

      {/* Main analytics content (DestDetailClient renders cards/charts) */}
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <h1 className="sr-only">Destination details</h1>
        <DestDetailClient dest={dest} />
      </div>
    </BackgroundMap>
  );
}
