"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DashboardCharts } from "./chart-types";

const COLORS = ["#64d2ff", "#30d158", "#ff9f0a", "#bf5af2", "#ff453a", "#ffd60a"];
const GRID = "rgba(255, 255, 255, 0.08)";
const TICK = { fill: "#9b9ba1", fontSize: 11 };
const TOOLTIP_STYLE = {
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 8,
  background: "#1b1b1f",
  color: "#f5f5f7",
  boxShadow: "0 18px 42px rgba(0, 0, 0, 0.28)"
};
const TOOLTIP_LABEL_STYLE = { color: "#f5f5f7", fontWeight: 700 };
const TOOLTIP_ITEM_STYLE = { color: "#d8d8de" };

function shortTick(value: string | number) {
  const label = String(value);
  return label.length > 12 ? `${label.slice(0, 11)}.` : label;
}

function ChartFrame({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="chart-frame">
      <div className="chart-heading">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="chart-canvas">{children}</div>
    </div>
  );
}

export function ChartsPanel({ charts }: { charts: DashboardCharts }) {
  return (
    <div className="charts-grid">
      <ChartFrame
        title="Topic Distribution"
        subtitle="Event count and average impact by extracted taxonomy."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.topicDistribution} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              tick={TICK}
              tickFormatter={shortTick}
              interval={0}
              angle={-24}
              textAnchor="end"
              height={72}
            />
            <YAxis tick={TICK} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Bar
              dataKey="count"
              radius={[8, 8, 0, 0]}
              fill="#64d2ff"
              isAnimationActive
              animationDuration={720}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Impact Timeline"
        subtitle="Average and maximum impact score across the coverage window."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={charts.impactTimeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="impactFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#30d158" stopOpacity={0.36} />
                <stop offset="95%" stopColor="#30d158" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={TICK} />
            <YAxis tick={TICK} domain={[0, 100]} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Area
              type="monotone"
              dataKey="avgImpact"
              stroke="#30d158"
              strokeWidth={2}
              fill="url(#impactFill)"
              isAnimationActive
              animationDuration={820}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Signal Radar"
        subtitle="Normalized average signal strength from validated fields."
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={charts.signalRadar} outerRadius="72%">
            <PolarGrid stroke={GRID} />
            <PolarAngleAxis dataKey="signal" tick={TICK} />
            <Radar
              dataKey="value"
              stroke="#bf5af2"
              fill="#bf5af2"
              fillOpacity={0.24}
              isAnimationActive
              animationDuration={760}
              animationEasing="ease-out"
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
          </RadarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Source Mix"
        subtitle="Feed categories used by the current report."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={charts.sourceMix}
            layout="vertical"
            margin={{ top: 8, right: 8, left: 18, bottom: 0 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={TICK} />
            <YAxis type="category" dataKey="type" tick={TICK} width={92} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Bar dataKey="count" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={720}>
              {charts.sourceMix.map((entry, index) => (
                <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Value Chain Map"
        subtitle="Where each signal lands in the AI stack."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={charts.valueChainMap} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="valueChain"
              tick={TICK}
              tickFormatter={shortTick}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={58}
            />
            <YAxis tick={TICK} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Bar
              dataKey="count"
              radius={[8, 8, 0, 0]}
              fill="#ff9f0a"
              isAnimationActive
              animationDuration={720}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
