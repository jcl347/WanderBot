// components/DestDetailClient.tsx
"use client";
import React from "react";
import SectionCard from "./SectionCard";
import MonthLine from "./MonthLine";
import MapLeaflet from "./MapLeaflet";
import LivePhotoPane from "./LivePhotoPane";

const INTEREST_KEYWORDS = [
  "beach",
  "food",
  "nightlife",
  "museum",
  "hiking",
  "park",
  "art",
  "market",
  "festival",
  "historic",
  "architecture",
  "music",
  "shopping",
  "viewpoint",
];

function pickKeywords(narrative: string, extra: string[] = [], max = 6) {
  const found = new Set<string>();
  const lower = narrative.toLowerCase();
  for (const k of INTEREST_KEYWORDS) if (lower.includes(k)) found.add(k);
  for (const e of extra) {
    const w = e.trim().toLowerCase();
    if (!w) continue;
    for (const k of INTEREST_KEYWORDS) if (w.includes(k)) found.add(k);
  }
  return Array.from(found).slice(0, max);
}

export default function DestDetailClient({ dest }: { dest: any }) {
  const fares = dest.per_traveler_fares ?? [];

  // Months series
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

  const analysis = dest.analysis ?? {};
  const center = analysis.map_center ?? dest.map_center ?? { lat: 40, lon: -20 };
  const markers = (analysis.map_markers ?? []).map((p: any) => ({
    position: [p.position?.[0] ?? 0, p.position?.[1] ?? 0] as [number, number],
    label: p.name,
  }));

  // Build smart image queries
  const highlightWords: string[] = Array.isArray(analysis.highlights) ? analysis.highlights : [];
  const markerNames: string[] = (analysis.map_markers || []).map((m: any) => m?.name).filter(Boolean);
  const base = dest.name;

  const kw = pickKeywords(dest.narrative || "", [...highlightWords, ...markerNames], 8);

  // Two themed queries: Sights and Lifestyle (food/nightlife/shopping)
  const leftQuery =
    `${base} landmarks sights ${markerNames.slice(0, 4).join(" ")} ${kw.join(" ")}`.trim();
  const rightQuery =
    `${base} ${["food", "nightlife", "market", "music", "shopping"].filter((k) => kw.includes(k)).join(" ")} ${highlightWords.slice(0, 4).join(" ")}`.trim() ||
    `${base} city views streets`.trim();

  return (
    <>
      {/* Mobile: keep single column collage feel (use leftQuery only) */}
      <div className="md:hidden space-y-4">
        <SectionCard>
          <h1 className="text-2xl font-semibold">{dest.name}</h1>
          <p className="text-neutral-700 whitespace-pre-line mt-2">{dest.narrative}</p>
        </SectionCard>

        <SectionCard tight>
          <LivePhotoPane query={leftQuery} count={6} title="Vibe check (photos)" />
        </SectionCard>
      </div>

      {/* Desktop: split panes */}
      <div className="hidden md:grid md:grid-cols-[320px_1fr_320px] md:gap-4">
        {/* Left sticky photos */}
        <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
          <SectionCard tight>
            <LivePhotoPane query={leftQuery} count={6} title="Vibe check" />
          </SectionCard>
        </aside>

        {/* Middle analytics/content */}
        <div className="space-y-4">
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
        </div>

        {/* Right sticky photos */}
        <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
          <SectionCard tight>
            <LivePhotoPane query={rightQuery} count={6} title="More views" />
          </SectionCard>
        </aside>
      </div>
    </>
  );
}
