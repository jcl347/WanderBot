"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

export default function MonthLine({ data }: { data: any[] }) {
  if (!data?.length) return null;
  const keys = Object.keys(data[0]).filter((k) => k !== "month");

  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          {keys.map((k) => (
            <Line key={k} type="monotone" dataKey={k} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
