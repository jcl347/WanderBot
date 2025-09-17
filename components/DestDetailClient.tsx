"use client";

import React from "react";
import SectionCard from "./SectionCard";
import MonthLine from "./MonthLine";
import MapLeaflet from "./MapLeaflet";
import LiveCollage from "./LiveCollage";

type Fare = {
  travelerName: string;
  from: string;
  avgUSD: number;
  monthBreakdown?: Array<{ month: string; avgUSD: number }>;
};

type Marker = { name?: string; position?: [number, number] };

function formatMonthYYYY(mm: string) {
  // expects "YYYY-MM"
  const [y, m] = String(mm).split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return isNaN(d.getTime())
    ? mm
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export default function DestDetailClient({ dest }: { dest: any }) {
  const fares: Fare[] = Array.isArray(dest?.per_traveler_fares) ? dest.per_traveler_fares : [];

  // ----- Build chart months -----
  const monthSet = new Set<string>();
  for (const f of fares) for (const m of f.monthBreakdown || []) if (m?.month) monthSet.add(m.month);
  let months = Array.from(monthSet).sort();

  if (months.length === 0) {
    const base = String(dest.best_month || dest.suggested_month || "2026-01").slice(0, 7);
    const [y, m] = base.split("-").map((x: string) => Number(x));
    const trio = [new Date(y, m - 2, 1), new Date(y, m - 1, 1), new Date(y, m, 1)];
    months = trio.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const series = months.map((m) => {
    const row: Record<string, number | string | null> = { month: m };
    for (const f of fares) {
      const found = f.monthBreakdown?.find((x) => x.month === m)?.avgUSD;
      row[f.travelerName] = Number.isFinite(found as number) ? (found as number) : f.avgUSD ?? null;
    }
    return row;
  });

  // ----- Map pins (coerce to numbers & guarantee at least one) -----
  const analysis = dest?.analysis ?? {};
  const rawMarkers: Marker[] = Array.isArray(analysis.map_markers) ? analysis.map_markers : [];

  let pins =
    rawMarkers
      .map((m) => {
        const lat = Number(m?.position?.[0]);
        const lon = Number(m?.position?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { position: [lat, lon] as [number, number], label: String(m?.name || dest?.name || "Pin") };
      })
      .filter(Boolean) as { position: [number, number]; label: string }[];

  const mc = analysis.map_center ?? dest.map_center;
  const hasCenter = Number.isFinite(mc?.lat) && Number.isFinite(mc?.lon);
  if (pins.length === 0 && hasCenter) {
    pins = [{ position: [mc.lat, mc.lon], label: String(dest?.name || "Center") }];
  }
  const center: [number, number] | undefined = hasCenter ? [mc.lat, mc.lon] : pins[0]?.position;

  // ----- Image query lists: simple "{city} {keyword}" phrases -----
  // Prefer model-provided analysis.image_queries (already short phrases).
  const modelQueries: string[] = Array.isArray(analysis.image_queries)
    ? analysis.image_queries.filter((s: unknown) => typeof s === "string" && s.trim())
    : [];

  let leftList: string[] = [];
  let rightList: string[] = [];

  if (modelQueries.length >= 2) {
    const mid = Math.ceil(modelQueries.length / 2);
    leftList = modelQueries.slice(0, mid);
    rightList = modelQueries.slice(mid);
  } else {
    // Very simple keyword rails to keep the images endpoint happy.
    const city = String(dest?.name || "").trim();
    const markerNames: string[] = (Array.isArray(rawMarkers) ? rawMarkers : [])
      .map((m) => (typeof m?.name === "string" ? m.name : ""))
      .filter(Boolean);

    leftList = [
      `${city} skyline`,
      `${city} downtown`,
      `${city} landmarks`,
      ...markerNames.slice(0, 3).map((n) => `${city} ${n}`),
    ].filter(Boolean);

    rightList = [
      `${city} street market`,
      `${city} nightlife`,
      `${city} live music`,
      `${city} coffee`,
      `${city} street art`,
      `${city} festival`,
      `${city} beach`,
    ];
  }

  return (
    <>
      <LiveCollage leftList={leftList} rightList={rightList} leftCount={10} rightCount={10} />

      <div className="md:col-start-2 md:row-start-1 md:px-0 space-y-4">
        <SectionCard>
          <h1 className="text-2xl font-semibold">{dest.name}</h1>
          <p className="text-neutral-700 whitespace-pre-line mt-2">{dest.narrative}</p>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-semibold mb-3">Monthly notes</h2>
          {dest.months?.length ? (
            <ul className="list-disc pl-6 text-sm">
              {dest.months.map((m: any) => (
                <li key={m.month}>
                  <span className="font-medium">{formatMonthYYYY(m.month)}:</span> {m.note}
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
          {center ? (
            <div className="h-64">
              <MapLeaflet center={center} zoom={pins.length > 1 ? 11 : 8} markers={pins} />
            </div>
          ) : (
            <div className="text-sm text-neutral-500">No map data available for this destination.</div>
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
                  <th className="p-2">Avg USD</th>
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
      </div>
    </>
  );
}
