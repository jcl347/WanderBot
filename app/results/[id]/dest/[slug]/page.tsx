// app/results/[id]/dest/[slug]/page.tsx
import Link from "next/link";
import Head from "next/head";
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
      {/* Preconnect to the image CDNs we use so rails paint faster */}
      <Head>
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
        <link rel="dns-prefetch" href="https://images.openverse.engineering" />
        <link rel="preconnect" href="https://images.openverse.engineering" crossOrigin="" />
      </Head>

      {/* Top bar aligned to the same centered width as the content */}
      <div className="mx-auto w-full max-w-[1320px] px-4 md:px-6">
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

      {/* Client component renders center content + left/right image rails */}
      <DestDetailClient dest={dest} />
    </BackgroundMap>
  );
}
