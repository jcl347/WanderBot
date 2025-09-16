// components/DestDetailClient.tsx
"use client";
import React from "react";
import SectionCard from "./SectionCard";
import MonthLine from "./MonthLine";
import MapLeaflet from "./MapLeaflet";
import PhotoCollage from "./PhotoCollage";

/** Reasonable fallbacks if the model didn't add map_center in analysis */
const FALLBACK_CENTERS: Record<string, { lat: number; lon: number }> = {
  // demo set
  lisbon: { lat: 38.7223, lon: -9.1393 },
  "mexico-city": { lat: 19.4326, lon: -99.1332 },
  montreal: { lat: 45.5017, lon: -73.5673 },
  "san-diego": { lat: 32.7157, lon: -117.1611 },
  honolulu: { lat: 21.3069, lon: -157.8583 },

  // US set you showed in screenshots
  austin: { lat: 30.2672, lon: -97.7431 },
  "austin-texas": { lat: 30.2672, lon: -97.7431 },
  "las-vegas": { lat: 36.1699, lon: -115.1398 },
  "los-angeles": { lat: 34.0522, lon: -118.2437 },
  nashville: { lat: 36.1627, lon: -86.7816 },
  "charleston-south-carolina": { lat: 32.7765, lon: -79.9311 },
  savannah: { lat: 32.0809, lon: -81.0912 },
  "new-orleans": { lat: 29.9511, lon: -90.0715 },
  miami: { lat: 25.7617, lon: -80.1918 },
  cancun: { lat: 21.1619, lon: -86.8515 },
  "puerto-vallarta": { lat: 20.6534, lon: -105.2253 },
};

function pickFallback(slug?: string) {
  if (!slug) return null;
  const key = slug.toLowerCase();
  if (FALLBACK_CENTERS[key]) return FALLBACK_CENTERS[key];
  // try a few forgiving variations
  const simple = key.replace(/[,._]/g, "").replace(/\s+/g, "-");
  return FALLBACK_CENTERS[simple] ?? null;
}

export default function DestDetailClient({ dest }: { dest: any }) {
  const fares = Array.isArray(dest.per_traveler_fares) ? dest.per_traveler_fares : [];
  const analysis = dest.analysis ?? {};

  // ---------------- month series ----------------
  const monthSet = new Set<string>();
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

  // ---------------- map center & markers ----------------
  const centerFromModel = analysis.map_center ?? dest.map_center ?? null;
  const center =
    centerFromModel ??
    pickFallback(dest.slug) ??
    { lat: 40, lon: -20 }; // wide Atlantic view as absolute fallback

  // Use model markers if present; otherwise show at least a center pin with a label
  let markers: { position: [number, number]; label: string }[] = Array.isArray(analysis.map_markers)
    ? analysis.map_markers
        .map((p: any) =>
          Array.isArray(p?.position) && p.position.length === 2
            ? { position: [Number(p.position[0]), Number(p.position[1])] as [number, number], label: String(p.name ?? dest.name) }
            : null
        )
        .filter(Boolean) as { position: [number, number]; label: string }[]
    : [];

  if (markers.length === 0 && typeof center?.lat === "number" && typeof center?.lon === "number") {
    markers = [{ position: [center.lat, center.lon], label: dest.name }];
  }

  // ---------------- photos ----------------
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
            zoom={markers.length > 1 ? 6 : 4}
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
