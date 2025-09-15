// app/results/[id]/dest/[slug]/page.tsx  (SERVER)
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import DestDetailClient from "@/components/DestDetailClient"; // client wrapper
import { q } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mockDestinationDetailBySlug } from "@/mocks/destinations";

type PageProps = { params: { id: string; slug: string } };

export default async function DestDetail({ params }: PageProps) {
  const { id, slug } = params;

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  if (!useMock) return notFound();

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

      {/* The server page can render simple static pieces, but put interactivity in client */}
      <DestDetailClient dest={dest} />
    </BackgroundMap>
  );
}
