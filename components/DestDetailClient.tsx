"use client";

import * as React from "react";
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

function smoothFareSeries(series: { month: string; avgUSD: number }[]) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const s = series
    .map((x) => ({
      month: x.month.slice(0, 7),
      avgUSD: Math.min(5000, Math.max(60, Number(x.avgUSD) || 0)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const out = s.map((x, i) => {
    const window = [s[i - 1]?.avgUSD, s[i].avgUSD, s[i + 1]?.avgUSD].filter(
      (v) => typeof v === "number"
    ) as number[];
    if (window.length < 2) return x;
    const sorted = [...window].sort((a, b) => a - b);
    const med =
      sorted.length % 2
        ? sorted[(sorted.length / 2) | 0]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    if (Math.abs(x.avgUSD - med) / Math.max(1, med) > 0.7) {
      return { month: x.month, avgUSD: Math.round(med * 0.85 + x.avgUSD * 0.15) };
    }
    return x;
  });

  return out;
}

function fillAndSmoothMonths(raw: Fare[]): Fare[] {
  const set = new Set<string>();
  for (const f of raw) for (const m of f.monthBreakdown || []) if (m?.month) set.add(m.month.slice(0, 7));
  let months = Array.from(set).sort();
  if (months.length === 0) {
    const d = new Date();
    const a = new Date(d.getFullYear(), d.getMonth(), 1);
    const b = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const c = new Date(d.getFullYear(), d.getMonth() + 2, 1);
    months = [a, b, c].map((x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }

  return raw.map((f) => {
    const mb = Array.isArray(f.monthBreakdown) ? [...f.monthBreakdown] : [];
    const byKey = new Map(mb.map((x) => [x.month.slice(0, 7), Number(x.avgUSD) || f.avgUSD || 0]));
    for (const m of months) {
      if (!byKey.has(m)) mb.push({ month: m, avgUSD: f.avgUSD });
    }
    const smoothed = smoothFareSeries(
      mb.map((x) => ({ month: x.month.slice(0, 7), avgUSD: Number(x.avgUSD) || f.avgUSD || 0 }))
    );
    const mean = smoothed.reduce((a, x) => a + x.avgUSD, 0) / Math.max(1, smoothed.length);
    return { ...f, avgUSD: Math.round(mean), monthBreakdown: smoothed };
  });
}

function buildCityTerms(dest: any, limit = 16) {
  const name: string = String(dest?.name || "").trim();
  const analysis = dest?.analysis ?? {};
  const model: string[] = Array.isArray(analysis.image_queries)
    ? analysis.image_queries.filter((s: unknown): s is string => typeof s === "string" && !!s.trim())
    : [];

  const done = model.length
    ? model
    : [
        "beach", "resort", "ocean view", "sunset", "promenade",
        "old town", "harbor", "pool", "rooftop bar", "nightlife",
        "street food", "market", "viewpoint", "lighthouse"
      ].map((k) => (name ? `${name} ${k}` : k));

  return Array.from(new Set(done)).slice(0, limit);
}

export default function DestDetailClient({ dest }: { dest: any }) {
  const fares = React.useMemo(() => {
    const raw: Fare[] = Array.isArray(dest?.per_traveler_fares) ? dest.per_traveler_fares : [];
    return fillAndSmoothMonths(raw);
  }, [dest?.per_traveler_fares]);

  const months = React.useMemo(() => {
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

  const series = React.useMemo(() => {
    return months.map((m) => {
      const row: Record<string, number | string | null> = { month: m };
      for (const f of fares) {
        const found = f.monthBreakdown?.find((x) => x.month === m)?.avgUSD;
        row[f.travelerName] = Number.isFinite(found as number) ? (found as number) : f.avgUSD ?? null;
      }
      return row;
    });
  }, [months, fares]);

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
  if (pins.length === 0 && hasCenter) pins = [{ position: [mc.lat, mc.lon], label: String(dest?.name || "Center") }];
  const center: [number, number] | undefined = hasCenter ? [mc.lat, mc.lon] : pins[0]?.position;

  const simpleTerms = React.useMemo(() => buildCityTerms(dest, 18), [dest]);
  const mid = Math.max(1, Math.ceil(simpleTerms.length / 2));
  const leftTerms = simpleTerms.slice(0, mid);
  const rightTerms = simpleTerms.slice(mid);

  return (
    <LiveCollage
      leftTerms={leftTerms}
      rightTerms={rightTerms}
      centerTerms={simpleTerms}
      railWidth={420}
      middleClassName="md:px-2"
    >
      <SectionCard>
        <h1 className="text-3xl font-semibold">{dest.name}</h1>
        <p className="text-neutral-700 whitespace-pre-line mt-3 text-lg leading-relaxed">
          {dest.narrative}
        </p>
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
          Estimated averages per traveler (round-trip, USD). Missing months are inferred and lightly smoothed.
        </p>
      </SectionCard>

      <SectionCard>
        <h2 className="text-lg font-semibold mb-3">Map</h2>
        {center ? (
          <div className="h-96">
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
    </LiveCollage>
  );
}
