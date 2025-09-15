// components/DestinationCard.tsx
import React from "react";

type MonthBreakdown = { month: string; avgUSD?: number };

export default function DestinationCard({ dest }: { dest: any }) {
  const analysis = dest.analysis ?? {};
  const fares = dest.per_traveler_fares ?? [];

  // typed parse of month breakdowns (safe when model output includes them)
  const months = (
    (analysis.per_traveler_fares?.[0]?.monthBreakdown ?? []) as MonthBreakdown[]
  ).map((m) => m.month);

  return (
    <article className="rounded-xl border p-4 bg-white/95">
      <h3 className="text-lg font-semibold">{dest.name}</h3>
      <p className="text-sm text-neutral-600 line-clamp-3">{dest.narrative}</p>

      {months.length > 0 && (
        <div className="mt-3 text-sm">
          <strong>Months (sample):</strong> {months.join(", ")}
        </div>
      )}

      {/* rest of your card... */}
    </article>
  );
}
