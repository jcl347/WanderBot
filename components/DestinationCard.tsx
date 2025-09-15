// components/DestinationCard.tsx
"use client";
import Link from "next/link";
import MonthLine from "./MonthLine";
import RobotBadge from "./RobotBadge";

export default function DestinationCard({ planId, dest }: { planId: string; dest: any }) {
  // dest includes analysis (full object) or we can fetch from server-side
  const analysis = dest.analysis ?? {};
  const fares = dest.per_traveler_fares ?? [];
  const months = (analysis.per_traveler_fares?.[0]?.monthBreakdown ?? []).map(m=>m.month) || [];

  return (
    <article className="rounded-xl border p-4 bg-white/95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{dest.name}</h3>
          <div className="text-sm text-neutral-600 line-clamp-3 mt-1">{dest.narrative}</div>
        </div>
        <div className="flex flex-col items-end">
          <RobotBadge small />
          {analysis.suggested_month && <div className="text-xs text-neutral-500 mt-2">Suggested: {analysis.suggested_month}</div>}
        </div>
      </div>

      {analysis.seasonal_warnings?.length ? (
        <div className="mt-3 text-xs text-amber-700">
          {analysis.seasonal_warnings.map((s:any)=>(
            <div key={s.month}>⚠ {s.month}: {s.note}</div>
          ))}
        </div>
      ) : null}

      {/* mini sparkline — reuse MonthLine if breakdown exists */}
      {fareMonthsExist(analysis) ? (
        <div className="mt-3 h-40">
          <MonthLine data={buildSeriesFromAnalysis(analysis)} />
        </div>
      ) : null}

      {/* How it satisfies people */}
      {analysis.satisfies?.length ? (
        <div className="mt-3 text-sm">
          <div className="font-medium">How it satisfies the group</div>
          <ul className="mt-1 text-sm">
            {analysis.satisfies.map((s:any)=>(
              <li key={s.travelerName}><strong>{s.travelerName}:</strong> {s.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex justify-between items-center">
        <Link href={`/results/${planId}/dest/${dest.slug}`} className="text-sm underline">View details →</Link>
        <div className="text-sm text-neutral-600">Avg: ${analysis.analytics?.avgUSD ?? "—"}</div>
      </div>
    </article>
  );

  function fareMonthsExist(a:any){
    // quick heuristic: is there monthBreakdown on first traveler?
    return Array.isArray(a.per_traveler_fares) && a.per_traveler_fares[0]?.monthBreakdown?.length;
  }
  function buildSeriesFromAnalysis(a:any){
    // convert analysis.per_traveler_fares into line chart series where keys are traveler names
    const fares = a.per_traveler_fares ?? [];
    const monthSet = new Set<string>();
    fares.forEach((f:any)=>f.monthBreakdown?.forEach((m:any)=>monthSet.add(m.month)));
    const months = Array.from(monthSet).sort();
    return months.map(m=>{
      const row:any = { month: m };
      fares.forEach((f:any)=>{ row[f.travelerName] = f.monthBreakdown?.find((x:any)=>x.month===m)?.avgUSD ?? null });
      return row;
    });
  }
}
