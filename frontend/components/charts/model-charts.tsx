"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "10px",
  fontSize: "11px",
  color: "var(--popover-foreground)",
  boxShadow: "0 18px 40px -18px var(--chart-tooltip-shadow)",
};

export interface AccuracyDatum {
  name: string;
  top1: number | null;
  top5: number | null;
}

export function AccuracyChart({ data }: { data: AccuracyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={4}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
          axisLine={{ stroke: "var(--chart-grid)" }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "var(--chart-axis-muted)", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          cursor={{ fill: "var(--chart-cursor)" }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: "var(--popover-foreground)", fontWeight: 500, marginBottom: 4 }}
          itemStyle={{ color: "var(--chart-tooltip-text)" }}
          formatter={(value) =>
            value === null || value === undefined ? "Not supplied" : [`${Number(value).toFixed(2)}%`, ""]
          }
        />
        <Legend
          verticalAlign="top"
          height={30}
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ fontSize: "10px", color: "var(--chart-legend)" }}
        />
        <Bar
          dataKey="top1"
          name="Top-1 accuracy"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={38}
          animationDuration={600}
        />
        <Bar
          dataKey="top5"
          name="Top-5 accuracy"
          fill="var(--chart-top5)"
          radius={[4, 4, 0, 0]}
          maxBarSize={38}
          animationDuration={600}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface LatencyDatum {
  name: string;
  latency: number | null;
  color: string;
}

export function LatencyChart({ data }: { data: LatencyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, left: 4, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "var(--chart-axis-muted)", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${Math.round(Number(value))} ms`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={108}
          tick={{ fill: "var(--chart-axis-strong)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--chart-cursor-soft)" }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: "var(--popover-foreground)", fontWeight: 500, marginBottom: 4 }}
          itemStyle={{ color: "var(--chart-tooltip-text)" }}
          formatter={(value) => [`${Math.round(Number(value))} ms`, "Latency"]}
        />
        <Bar dataKey="latency" radius={[0, 5, 5, 0]} maxBarSize={22} animationDuration={600}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} fillOpacity={0.86} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
