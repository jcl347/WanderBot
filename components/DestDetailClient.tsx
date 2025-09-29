"use client";

import * as React from "react";
import SectionCard from "./SectionCard";
import MonthLine from "./MonthLine";
import MapLeaflet from "./MapLeaflet";
import LivePhotoPane from "./LivePhotoPane";

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

/** Clamp & light median smoothing to tamp down spikes */
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

/** Fill missing months by carrying the avg across the visible window (3-month local) */
function fillAndSmoothMonths(raw: Fare[]): Fare[] {
  // Determine months we’ll graph from the data; fallback to current + next 2
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
    const mean =
      smoothed.reduce((a, x) => a + x.avgUSD, 0) / Math.max(1, smoothed.length);
    return {
      ...f,
      avgUSD: Math.round(mean),
      monthBreakdown: smoothed,
    };
  });
}

/** Build simple “City + one word” image terms using model-provided hints if present. */
function buildCityTerms(dest: any, limit = 12) {
  const name: string = String(dest?.name || "").trim();
  const analysis = dest?.analysis ?? {};
  const model = Array.isArray(analysis.image_queries)
    ? analysis.image_queries
        .filter((s: unknown) => typeof s === "string" && s.trim())
        .map((s: string) => s.trim())
    : [];

  if (model.length) {
    // Force each term to "City + one word/short phrase"
    const cleaned = model.map((t) => {
      const one = t.replace(/\s+/g, " ").trim();
      if (one.toLowerCase().startsWith(name.toLowerCase() + " ")) return one;
      return name ? `${name} ${one}` : one;
    });
    return Array.from(new Set(cleaned)).slice(0, limit);
  }

  // Otherwise generate a small, simple set
  const basics = [
    "skyline",
    "downtown",
    "beach",
    "park",
    "museum",
    "nightlife",
    "market",
    "street",
    "festival",
    "landmarks",
  ].map((k) => `${name} ${k}`);

  return Array.from(new Set(basics)).slice(0, limit);
}

export default function DestDetailClient({ dest }: { dest: any }) {
  // ---- Fares (filled + smoothed) ----
  const fares = React.useMemo(() => {
    const raw: Fare[] = Array.isArray(dest?.per_traveler_fares) ? dest.per_traveler_fares : [];
    return fillAndSmoothMonths(raw);
  }, [dest?.per_traveler_fares]);

  // ---- Months for the time series ----
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

  // ---- Series for MonthLine ----
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

  // ---- Map pins ----
  const analysis = dest?.analysis ?? {};
  const rawMarkers: Marker[] = Array.isArray(analysis.map_markers) ? analysis.map_markers : [];

  let pins =
    rawMarkers
      .map((m) => {
        const lat = Number(m?.position?.[0]);
        const lon = Number(m?.position?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          position: [lat, lon] as [number, number],
          label: String(m?.name || dest?.name || "Pin"),
        };
      })
      .filter(Boolean) as { position: [number, number]; label: string }[];

  const mc = analysis.map_center ?? dest.map_center;
  const hasCenter = Number.isFinite(mc?.lat) && Number.isFinite(mc?.lon);
  if (pins.length === 0 && hasCenter) {
    pins = [{ position: [mc.lat, mc.lon], label: String(dest?.name || "Center") }];
  }
  const center: [number, number] | undefined = hasCenter ? [mc.lat, mc.lon] : pins[0]?.position;

  // ---- Image terms (simple) ----
  const simpleTerms = React.useMemo(() => buildCityTerms(dest, 12), [dest]);

  // Split list in half for left/right rails
  const mid = Math.max(1, Math.ceil(simpleTerms.length / 2));
  const leftTerms = simpleTerms.slice(0, mid);
  const rightTerms = simpleTerms.slice(mid);

  return (
    <>
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
            Estimated averages per traveler (round-trip, USD). Missing months are inferred and lightly smoothed.
          </p>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-semibold mb-3">Map</h2>
          {center ? (
            <div className="h-72">
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

      {/* Collage AT THE BOTTOM (as requested) and wider on large screens */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <LivePhotoPane terms={leftTerms} count={12} orientation="left" />
        <LivePhotoPane terms={rightTerms} count={12} orientation="right" />
      </div>
    </>
  );
}
