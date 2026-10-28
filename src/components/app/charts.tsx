import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty } from "./kit";

export const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 } };
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

export function BarC({ data, color = COLORS[0], horizontal, height = 240 }: { data: { name: string; value: number }[]; color?: string; horizontal?: boolean; height?: number }) {
  if (!data.length || data.every((d) => !d.value)) return <Empty title="No data for this view" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 20 : 0, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!horizontal} horizontal={!!horizontal || true} />
        {horizontal ? <><XAxis type="number" allowDecimals={false} tick={axis} /><YAxis type="category" dataKey="name" tick={axis} width={110} /></> : <><XAxis dataKey="name" tick={axis} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 50 : 30} /><YAxis allowDecimals={false} tick={axis} width={30} /></>}
        <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="value" name="Cases" fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieC({ data, height = 240 }: { data: { name: string; value: number }[]; height?: number }) {
  if (!data.length) return <Empty title="No data for this view" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LineC({ data, lines, height = 240 }: { data: Record<string, string | number | null>[]; lines: { key: string; name: string; color: string }[]; height?: number }) {
  if (!data.length) return <Empty title="No data for this view" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={axis} />
        <YAxis allowDecimals tick={axis} width={30} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {lines.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
