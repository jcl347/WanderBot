// components/DestDetailClient.tsx
"use client";
import React, { useMemo } from "react";
import SectionCard from "./SectionCard";
import MonthLine from "./MonthLine";
import MapLeaflet from "./MapLeaflet";

export default function DestDetailClient({ dest }: { dest: any }) {
  const fares = dest.per_traveler_fares ?? [];

  const monthSet = new Set<string>();
  fares.forEach((f: any) => f.monthBreakdown?.forEach((m: any) => monthSet.add(m.month)));
  const months = Array.from(monthSet).sort();
  const series = months.map((m) => {
    const row: Record<string, number | string | null> = { month: m };
    fares.forEach((f: any) => {
      row[f.travelerName] =
        f.monthBreakdown?.find((x: any) => x.month === m)?.avgUSD ?? null;
    });
    return row;
  });

  // map center fallback — allow dest.map_center or default to world coords
  const center = dest.map_center ?? { lat: 40, lon: -20 };

  return (
    <>
      <SectionCard>
        <h1 className="text-2xl font-semibold">{dest.name}</h1>
        <p className="text-neutral-700 whitespace-pre-line mt-2">{dest.narrative}</p>
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
        <h2 className="text-lg font-semibold mb-3">Map</h2>
        <div className="h-64">
          <MapLeaflet center={[center.lat, center.lon]} markerLabel={dest.name} />
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
