// components/DestDetailClient.tsx
"use client";

import React, { useMemo } from "react";
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
  const [y, m] = String(mm).split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return isNaN(d.getTime())
    ? mm
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fillAndSmoothMonths(fares: Fare[]) {
  const months = new Set<string>();
  for (const f of fares) for (const m of f.monthBreakdown || []) months.add(m.month.slice(0, 7));
  const sortedMonths = Array.from(months).sort();

  return fares.map((f) => {
    const map = new Map<string, number>();
    (f.monthBreakdown || []).forEach((m) => map.set(m.month.slice(0, 7), m.avgUSD));
    const series = sortedMonths.map((m) => {
      if (map.has(m)) return { month: m, avgUSD: clamp(map.get(m)!, 60, 5000) };
      const vals = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      if (!vals.length) return { month: m, avgUSD: clamp(f.avgUSD, 60, 5000) };
      const before = vals.filter(([mm]) => mm <= m).pop();
      const after = vals.find(([mm]) => mm >= m);
      const v =
        before && after ? (before[1] + after[1]) / 2 : before ? before[1] : after ? after[1] : f.avgUSD;
      return { month: m, avgUSD: clamp(v, 60, 5000) };
    });

    const sm = series.map((x, i) => {
      const win = [series[i - 1]?.avgUSD, x.avgUSD, series[i + 1]?.avgUSD].filter(
        (v) => typeof v === "number"
      ) as number[];
      if (win.length < 2) return x;
      const sorted = [...win].sort((a, b) => a - b);
      const med =
        sorted.length % 2
          ? sorted[(sorted.length / 2) | 0]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      if (Math.abs(x.avgUSD - med) / Math.max(1, med) > 0.7) {
        return { month: x.month, avgUSD: Math.round(med * 0.85 + x.avgUSD * 0.15) };
      }
      return x;
    });

    const mean = sm.reduce((a, b) => a + b.avgUSD, 0) / Math.max(1, sm.length);
    return { travelerName: f.travelerName, from: f.from, avgUSD: Math.round(mean), monthBreakdown: sm };
  });
}

export default function DestDetailClient({ dest }: { dest: any }) {
  const faresRaw: Fare[] = Array.isArray(dest?.per_traveler_fares) ? dest.per_traveler_fares : [];

  const fares = useMemo(() => fillAndSmoothMonths(faresRaw), [faresRaw]);

  const months = useMemo(() => {
    const s = new Set<string>();
    for (const f of fares) for (const m of f.monthBreakdown || []) s.add(m.month);
    const arr = Array.from(s).sort();
    if (arr.length) return arr;
    const d = new Date();
    const a = new Date(d.getFullYear(), d.getMonth(), 1);
    const b = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const c = new Date(d.getFullYear(), d.getMonth() + 2, 1);
    return [a, b, c].map((x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }, [fares]);

  const series = useMemo(() => {
    return months.map((m) => {
      const row: Record<string, number | string | null> = { month: m };
      for (const f of fares) {
        const found = f.monthBreakdown?.find((x) => x.month === m)?.avgUSD;
        row[f.travelerName] = Number.isFinite(found as number) ? (found as number) : f.avgUSD ?? null;
      }
      return row;
    });
  }, [months, fares]);

  // Map pins
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

  // Simple image terms (city + 1 word/POI)
  const city = String(dest?.name || "").trim();
  const markerNames: string[] = (Array.isArray(rawMarkers) ? rawMarkers : [])
    .map((m) => (typeof m?.name === "string" ? m.name : ""))
    .filter(Boolean);

  const basics = ["skyline", "downtown", "museum", "park", "nightlife", "beach", "market"];
  const leftList = [
    city + " " + (markerNames[0] || basics[0]),
    city + " " + (markerNames[1] || basics[1]),
    city + " " + (markerNames[2] || basics[2]),
  ];
  const rightList = [
    city + " " + basics[3],
    city + " " + basics[4],
    city + " " + basics[5],
    city + " " + basics[6],
  ];

  return (
    <>
      {/* Center column */}
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
            Estimated averages per traveler (round-trip, USD). Missing months are filled and lightly smoothed.
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

      {/* Larger side collage at the bottom (preloaded in pane) */}
      <LiveCollage className="mt-6" leftList={leftList} rightList={rightList} leftCount={16} rightCount={16} />
    </>
  );
}
