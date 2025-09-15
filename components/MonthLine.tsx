// components/MonthLine.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function MonthLine({ data }: { data: any[] }) {
  const keys = Object.keys(data[0] || {}).filter(k => k !== "month");
  return (
    <div className="w-full h-64">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(v:any)=> v ? `$${Math.round(v)}` : "-" } />
          <Legend />
          {keys.map((k) => (
            <Line key={k} type="monotone" dataKey={k} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
