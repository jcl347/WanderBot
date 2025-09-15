"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";

type Item = {
  name: string;
  slug: string;
  totalGroupUSD: number;
  avgPerPersonUSD: number;
};

export default function CostComparisons({ data }: { data: Item[] }) {
  // pretty colors (colorblind-friendly-ish palette)
  const palette = [
    "#22c55e", // green
    "#0ea5e9", // sky
    "#f59e0b", // amber
    "#a78bfa", // violet
    "#ef4444", // red
    "#10b981", // emerald
  ];

  const bySlugColor: Record<string, string> = {};
  data.forEach((d, i) => (bySlugColor[d.slug] = palette[i % palette.length]));

  const friendly = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="w-full">
      <div className="mb-2 text-sm text-neutral-600">
        Group total and per-person averages for each destination.
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 12, left: 12, bottom: 12 }}
          >
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `$${v / 1000}k`} />
            <Tooltip
              formatter={(v: number, key) =>
                key === "totalGroupUSD" ? [friendly(v), "Group total"] : [friendly(v), "Per person"]
              }
              labelClassName="text-sm font-medium"
            />
            <Legend />
            <Bar
              dataKey="totalGroupUSD"
              name="Group total"
              radius={[8, 8, 0, 0]}
              fillOpacity={0.95}
            >
              <LabelList
                position="top"
                formatter={(v: number) => friendly(v)}
                className="text-xs"
              />
              {data.map((entry, index) => (
                <svg key={`grad-${entry.slug}`} />
              ))}
            </Bar>
            <Bar
              dataKey="avgPerPersonUSD"
              name="Per person"
              radius={[8, 8, 0, 0]}
              fillOpacity={0.8}
            >
              <LabelList
                position="top"
                formatter={(v: number) => friendly(v)}
                className="text-xs"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* colored legend chips by slug (ties bars to destinations) */}
      <div className="mt-3 flex flex-wrap gap-3">
        {data.map((d) => (
          <div
            key={d.slug}
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm shadow-sm"
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: bySlugColor[d.slug] }}
            />
            <span className="font-medium">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
