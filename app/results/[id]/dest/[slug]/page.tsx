// app/results/[id]/dest/[slug]/page.tsx
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
      {/* Preconnect so rails paint faster */}
      <Head>
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
        <link rel="dns-prefetch" href="https://images.openverse.engineering" />
        <link rel="preconnect" href="https://images.openverse.engineering" crossOrigin="" />
      </Head>

      {/* Header bar (no back link) and a subtle left shift to reclaim blank space */}
      <div className="mx-auto w-full max-w-[1850px] px-3 md:px-6 md:-ml-6">
        <div className="flex items-center justify-end py-2">
          <RobotBadge />
        </div>
      </div>

      {/* Center analytics + left/right rails */}
      <DestDetailClient dest={dest} />
    </BackgroundMap>
  );
}
