import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";
import { Empty } from "./kit";

/** SVG presentation attributes can't resolve CSS variables, so read design tokens at runtime. */
function useResolved(v: string) {
  const [c, setC] = useState(v);
  useEffect(() => {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    if (m) setC(getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || v);
  }, [v]);
  return c;
}
function useResolvedList(vs: string[]) {
  const [cs, setCs] = useState(vs);
  useEffect(() => {
    const st = getComputedStyle(document.documentElement);
    setCs(vs.map((v) => { const m = /^var\((--[\w-]+)\)$/.exec(v); return m ? st.getPropertyValue(m[1]).trim() || v : v; }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vs.join()]);
  return cs;
}

export const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 } };
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

export function BarC({ data, color = COLORS[0], horizontal, height = 240 }: { data: { name: string; value: number }[]; color?: string; horizontal?: boolean; height?: number }) {
  const fill = useResolved(color);
  if (!data.length || data.every((d) => !d.value)) return <Empty title="No data for this view" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 20 : 0, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!horizontal} horizontal={!!horizontal || true} />
        <XAxis type={horizontal ? "number" : "category"} dataKey={horizontal ? undefined : "name"} allowDecimals={false} tick={axis} interval={0} angle={!horizontal && data.length > 5 ? -20 : 0} textAnchor={!horizontal && data.length > 5 ? "end" : "middle"} height={!horizontal && data.length > 5 ? 50 : 30} />
        <YAxis type={horizontal ? "category" : "number"} dataKey={horizontal ? "name" : undefined} allowDecimals={false} tick={axis} width={horizontal ? 110 : 30} />
        <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="value" name="Cases" fill={fill} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieC({ data, height = 240 }: { data: { name: string; value: number }[]; height?: number }) {
  const cols = useResolvedList(COLORS);
  if (!data.length) return <Empty title="No data for this view" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} isAnimationActive={false}>
          {data.map((_, i) => <Cell key={i} fill={cols[i % cols.length]} />)}
        </Pie>
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LineC({ data, lines, height = 240 }: { data: Record<string, string | number | null>[]; lines: { key: string; name: string; color: string }[]; height?: number }) {
  const cols = useResolvedList(lines.map((l) => l.color));
  if (!data.length) return <Empty title="No data for this view" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={axis} />
        <YAxis allowDecimals tick={axis} width={30} />
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {lines.map((l, i) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={cols[i]} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
