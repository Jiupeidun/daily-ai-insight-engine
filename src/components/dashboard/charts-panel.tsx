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

const COLORS = ["#2563eb", "#0f766e", "#b45309", "#9333ea", "#dc2626", "#4f46e5"];

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
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} height={52} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#2563eb" />
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
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.36} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="avgImpact"
              stroke="#0f766e"
              strokeWidth={2}
              fill="url(#impactFill)"
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
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="signal" tick={{ fontSize: 11 }} />
            <Radar dataKey="value" stroke="#9333ea" fill="#9333ea" fillOpacity={0.2} />
            <Tooltip />
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
            <CartesianGrid stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={92} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
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
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="valueChain" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#b45309" />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
