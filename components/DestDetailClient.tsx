// components/DestDetailClient.tsx
"use client";
import React from "react";
import SectionCard from "./SectionCard";
import MonthLine from "./MonthLine";
import MapLeaflet from "./MapLeaflet";
import PhotoCollage from "./PhotoCollage";

export default function DestDetailClient({ dest }: { dest: any }) {
  const fares = dest.per_traveler_fares ?? [];

  // Build month series; synthesize if missing
  const monthSet = new Set<string>(); // ✅ const (fix prefer-const)
  fares.forEach((f: any) => f.monthBreakdown?.forEach((m: any) => monthSet.add(m.month)));
  let months = Array.from(monthSet).sort();

  if (months.length === 0) {
    const base = (dest.best_month || dest.suggested_month || "2026-01").slice(0, 7);
    const [y, m] = base.split("-").map((x: string) => Number(x));
    const trio = [new Date(y, m - 2, 1), new Date(y, m - 1, 1), new Date(y, m, 1)];
    months = trio.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const series = months.map((m) => {
    const row: Record<string, number | string | null> = { month: m };
    fares.forEach((f: any) => {
      const found = f.monthBreakdown?.find((x: any) => x.month === m)?.avgUSD;
      row[f.travelerName] = typeof found === "number" ? found : f.avgUSD ?? null;
    });
    return row;
  });

  const analysis = dest.analysis ?? {};
  const center = analysis.map_center ?? dest.map_center ?? { lat: 40, lon: -20 };
  const markers = (analysis.map_markers ?? []).map((p: any) => ({
    position: [p.position?.[0] ?? 0, p.position?.[1] ?? 0] as [number, number],
    label: p.name,
  }));

  const photos = analysis.photos ?? dest.photos;
  const photo_attribution = analysis.photo_attribution ?? dest.photo_attribution;

  return (
    <>
      <SectionCard>
        <h1 className="text-2xl font-semibold">{dest.name}</h1>
        <p className="text-neutral-700 whitespace-pre-line mt-2">{dest.narrative}</p>
      </SectionCard>

      <SectionCard tight>
        <h2 className="text-lg font-semibold mb-3">Vibe check (photos)</h2>
        <PhotoCollage slug={dest.slug} photos={photos} />
        {photo_attribution && (
          <p className="mt-2 text-xs text-neutral-500">{photo_attribution}</p>
        )}
      </SectionCard>

      <SectionCard tight>
        <h2 className="text-lg font-semibold mb-3">Monthly notes</h2>
        {dest.months?.length ? (
          <ul className="list-disc pl-6 text-sm">
            {dest.months.map((m: any) => (
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
        <MonthLine data={series} />
        <p className="text-xs text-neutral-500 mt-2">
          Estimated averages per traveler (round-trip, USD). Missing months are inferred.
        </p>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Map</h2>
        <div className="h-64">
          <MapLeaflet
            center={[center.lat, center.lon]}
            zoom={markers.length ? 10 : 3}
            markers={markers}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Per-traveler average fares</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Traveler</th>
                <th className="p-2">From</th>
                <th className="p-2">Avg USD</th>
              </tr>
            </thead>
            <tbody>
              {fares.map((f: any, i: number) => (
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
    </>
  );
}
