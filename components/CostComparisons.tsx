"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function CostComparisons({
  data,
}: {
  data: { name: string; totalGroupUSD: number; avgPerPersonUSD: number }[];
}) {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        <BarChart data={data}>
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
