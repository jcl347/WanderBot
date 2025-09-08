"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Row = { name: string; totalGroupUSD: number; avgPerPersonUSD: number };

export default function CostBars({ data }: { data: Row[] }) {
  const safe = Array.isArray(data) ? data : [];
  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        <BarChart data={safe}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="totalGroupUSD" name="Total (Group)" />
          <Bar dataKey="avgPerPersonUSD" name="Avg per Person" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
