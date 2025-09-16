// components/DestDetailClient.tsx
"use client";
import React from "react";
import SectionCard from "./SectionCard";
import MonthLine from "./MonthLine";
import MapLeaflet from "./MapLeaflet";
import PhotoCollage from "./PhotoCollage";

function PhotoTile({ src }: { src: string }) {
  return (
    <div className="aspect-[4/3] overflow-hidden rounded-xl border bg-white/60">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
        loading="lazy"
      />
    </div>
  );
}

export default function DestDetailClient({ dest }: { dest: any }) {
  const fares = dest.per_traveler_fares ?? [];

  // Build month series; synthesize if missing
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

  const photos: string[] = (analysis.photos ?? dest.photos ?? []) as string[];
  const photo_attribution = analysis.photo_attribution ?? dest.photo_attribution;

  // Split photos: 0–1 left, 2–3 right
  const leftPhotos = photos.slice(0, 2);
  const rightPhotos = photos.slice(2, 4);

  return (
    <>
      {/* Mobile/tablet: show one collage at the top for quick vibe check */}
      <div className="md:hidden space-y-4">
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
      </div>

      {/* Desktop: three-column layout with split photo panes */}
      <div className="hidden md:grid md:grid-cols-[320px_1fr_320px] md:gap-4">
        {/* Left photo pane (sticky) */}
        <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)] space-y-2">
          <SectionCard tight>
            <h2 className="text-lg font-semibold mb-3">Vibe check</h2>
            <div className="grid grid-cols-1 gap-2">
              {leftPhotos.length === 0 ? (
                <div className="text-sm text-neutral-500">Photos not available.</div>
              ) : (
                leftPhotos.map((src, i) => <PhotoTile key={i} src={src} />)
              )}
            </div>
            {photo_attribution && (
              <p className="mt-2 text-xs text-neutral-500">{photo_attribution}</p>
            )}
          </SectionCard>
        </aside>

        {/* Main content */}
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

        {/* Right photo pane (sticky) */}
        <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)] space-y-2">
          <SectionCard tight>
            <h2 className="text-lg font-semibold mb-3">More views</h2>
            <div className="grid grid-cols-1 gap-2">
              {rightPhotos.length === 0 ? (
                <div className="text-sm text-neutral-500">Photos not available.</div>
              ) : (
                rightPhotos.map((src, i) => <PhotoTile key={i} src={src} />)
              )}
            </div>
          </SectionCard>
        </aside>
      </div>
    </>
  );
}
