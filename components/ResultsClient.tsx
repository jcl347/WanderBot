// components/ResultsClient.tsx
"use client";
import React from "react";
import CostComparisons from "./CostComparisons";
import Link from "next/link";

export default function ResultsClient({
  plan,
  destinations,
  useMock,
  planId,
}: {
  plan: any;
  destinations: any[];
  useMock: boolean;
  planId: string;
}) {
  const summary = plan.summary ?? { destinations: [] };

  return (
    <>
      <section className="rounded-xl bg-white border p-4">
        <h2 className="text-lg font-semibold mb-4">Cost comparison</h2>
        <CostComparisons data={summary.destinations || []} />
      </section>

      <section className="rounded-xl bg-white border p-4">
        <h2 className="text-lg font-semibold mb-3">Destinations</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {destinations.map((d: any) => (
            <Link
              key={d.slug}
              href={`/results/${useMock ? "demo" : planId}/dest/${d.slug}`}
              className="rounded-xl border p-4 bg-white/90 hover:shadow-sm"
            >
              <div className="font-medium">{d.name}</div>
              <div className="text-sm text-neutral-600 line-clamp-3">
                {d.narrative}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
