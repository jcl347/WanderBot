"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

/**
 * data format:
 * [
 *   { month: "2026-01", "Alex": 720, "Sam": 700, ... },
 *   ...
 * ]
 */
export default function MonthLine({ data }: { data: Array<Record<string, number | string | null>> }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-neutral-500">No monthly trend available.</div>;
  }

  const keys = Object.keys(data[0]).filter((k) => k !== "month");
  const friendly = (n: number) => `$${Math.round(n).toLocaleString()}`;

  // color palette per traveler line
  const palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#10b981"];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 24, left: 12, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v: any) => (typeof v === "number" ? friendly(v) : v)} />
          <Legend />
          {keys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={palette[i % palette.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
