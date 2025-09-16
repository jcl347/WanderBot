import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import RobotBadge from "@/components/RobotBadge";
import DestDetailClient from "@/components/DestDetailClient";
import { q } from "@/lib/db";
import { mockDestinationDetailBySlug } from "@/mocks/destinations";

type PageProps = { params: { id: string; slug: string } };

export default async function DestDetail({ params }: PageProps) {
  const { id, slug } = params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  if (!useMock) {
    const [dest] = await q<any>(
      `select slug, name, narrative, months, per_traveler_fares, analysis
         from destinations
        where plan_id = $1 and slug = $2
        limit 1`,
      [id, slug]
    );
    if (!dest) return notFound();

    return (
      <BackgroundMap>
        <div className="flex items-center justify-between">
          <RobotBadge />
          <Link href={`/results/${id}`} className="text-sm text-sky-700 underline">
            ← Back to results
          </Link>
        </div>
        <DestDetailClient dest={dest} />
      </BackgroundMap>
    );
  }

  const dest = mockDestinationDetailBySlug[slug];
  if (!dest) return notFound();

  return (
    <BackgroundMap>
      <div className="flex items-center justify-between">
        <RobotBadge />
        <Link href={`/results/${id}`} className="text-sm text-sky-700 underline">
          ← Back to results
        </Link>
      </div>
      <DestDetailClient dest={dest} />
    </BackgroundMap>
  );
}
