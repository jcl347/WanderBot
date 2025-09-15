// app/results/[id]/dest/[slug]/page.tsx (SERVER)
import Link from "next/link";
import { notFound } from "next/navigation";
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import MonthLine from "@/components/MonthLine"; // client chart
import { mockDestinationDetailBySlug } from "@/mocks/destinations";

type PageProps = { params: Promise<{ id: string; slug: string }> };

export default async function DestDetail({ params }: PageProps) {
  const { id, slug } = await params; // <- await params

  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  if (!useMock) return notFound();

  const dest = mockDestinationDetailBySlug[slug];
  if (!dest) return notFound();

  const fares = dest.per_traveler_fares ?? [];

  // Build month series (optional)
  const monthSet = new Set<string>();
  fares.forEach((f) => f.monthBreakdown?.forEach((m) => monthSet.add(m.month)));
  const months = Array.from(monthSet).sort();
  const series = months.map((m) => {
    const row: Record<string, number | string | null> = { month: m };
    fares.forEach((f) => {
      row[f.travelerName] =
        f.monthBreakdown?.find((x) => x.month === m)?.avgUSD ?? null;
    });
    return row;
  });

  return (
    <BackgroundMap>
      <div className="flex items-center justify-between">
        <RobotBadge />
        <Link href={`/results/${id}`} className="text-sm text-sky-700 underline">
          ← Back to results
        </Link>
      </div>

      <SectionCard>
        <h1 className="text-2xl font-semibold">{dest.name}</h1>
        <p className="text-neutral-700 whitespace-pre-line mt-2">
          {dest.narrative}
        </p>
      </SectionCard>

      <SectionCard tight>
        <h2 className="text-lg font-semibold mb-3">Monthly notes</h2>
        {dest.months?.length ? (
          <ul className="list-disc pl-6 text-sm">
            {dest.months.map((m) => (
              <li key={m.month}>
                <span className="font-medium">{m.month}:</span> {m.note}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-neutral-500">No month notes.</div>
        )}
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Monthly fare trend</h2>
        {series.length ? (
          <>
            <MonthLine data={series} />
            <p className="text-xs text-neutral-500 mt-2">
              Mock averages per traveler (round-trip, USD).
            </p>
          </>
        ) : (
          <div className="text-sm text-neutral-500">No month breakdown provided.</div>
        )}
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Per-traveler average fares</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Traveler</th>
                <th className="p-2">From</th>
                <th className="p2">Avg USD</th>
              </tr>
            </thead>
            <tbody>
              {fares.map((f, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{f.travelerName}</td>
                  <td className="p-2">{f.from}</td>
                  <td className="p-2">${Math.round(f.avgUSD).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </BackgroundMap>
  );
}
