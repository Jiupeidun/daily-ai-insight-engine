"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
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
type Locale = "zh" | "en";

const CHART_COPY = {
  topicDistribution: {
    title: { zh: "主题分布", en: "Topic Distribution" },
    subtitle: {
      zh: "按抽取分类统计事件数量与平均影响分。",
      en: "Event count and average impact by extracted taxonomy."
    }
  },
  impactTimeline: {
    title: { zh: "影响时间线", en: "Impact Timeline" },
    subtitle: {
      zh: "覆盖窗口内的平均与最高影响分。",
      en: "Average and maximum impact score across the coverage window."
    }
  },
  signalRadar: {
    title: { zh: "信号雷达", en: "Signal Radar" },
    subtitle: {
      zh: "基于结构化字段归一化后的平均信号强度。",
      en: "Normalized average signal strength from validated fields."
    }
  },
  sourceMix: {
    title: { zh: "来源结构", en: "Source Mix" },
    subtitle: {
      zh: "当前日报使用的信息源类型。",
      en: "Feed categories used by the current report."
    }
  },
  valueChainMap: {
    title: { zh: "价值链地图", en: "Value Chain Map" },
    subtitle: {
      zh: "每条信号在 AI 产业链中的位置。",
      en: "Where each signal lands in the AI stack."
    }
  }
} as const;

const TOPIC_LABELS_ZH: Record<string, string> = {
  "Frontier models": "前沿模型",
  "AI infrastructure": "AI 基础设施",
  "Product launches": "产品发布",
  Research: "研究",
  "Open source": "开源",
  "Policy and regulation": "政策监管",
  "Capital markets": "资本市场",
  "Safety and security": "安全治理",
  "Enterprise adoption": "企业采用",
  "Developer tools": "开发者工具"
};

const SOURCE_LABELS_ZH: Record<string, string> = {
  "tech media": "科技媒体",
  official: "官方来源",
  research: "研究机构",
  developer: "开发者",
  aggregator: "聚合源",
  social: "社交来源"
};

const SIGNAL_LABELS_ZH: Record<string, string> = {
  Novelty: "新颖度",
  Adoption: "采用度",
  "Technical depth": "技术深度",
  "Regulatory weight": "监管权重",
  "Capital intensity": "资本强度"
};

const VALUE_CHAIN_LABELS_ZH: Record<string, string> = {
  model: "模型",
  data: "数据",
  compute: "算力",
  application: "应用",
  tooling: "工具",
  governance: "治理",
  market: "市场"
};

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
  children: ReactNode;
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

function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setLocale(root.dataset.lang === "en" ? "en" : "zh");
    const observer = new MutationObserver(update);
    update();
    observer.observe(root, { attributes: true, attributeFilter: ["data-lang"] });
    return () => observer.disconnect();
  }, []);

  return locale;
}

function localizedLabel(locale: Locale, label: string, map: Record<string, string>) {
  return locale === "zh" ? (map[label] ?? label) : label;
}

export function ChartsPanel({ charts }: { charts: DashboardCharts }) {
  const locale = useLocale();
  const localizedCharts = useMemo(
    () => ({
      topicDistribution: charts.topicDistribution.map((item) => ({
        ...item,
        localizedLabel: localizedLabel(locale, item.label, TOPIC_LABELS_ZH)
      })),
      sourceMix: charts.sourceMix.map((item) => ({
        ...item,
        localizedType: localizedLabel(locale, item.type, SOURCE_LABELS_ZH)
      })),
      signalRadar: charts.signalRadar.map((item) => ({
        ...item,
        localizedSignal: localizedLabel(locale, item.signal, SIGNAL_LABELS_ZH)
      })),
      valueChainMap: charts.valueChainMap.map((item) => ({
        ...item,
        localizedValueChain: localizedLabel(locale, item.valueChain, VALUE_CHAIN_LABELS_ZH)
      })),
      impactTimeline: charts.impactTimeline
    }),
    [charts, locale]
  );
  const copy = CHART_COPY;

  return (
    <div className="charts-grid">
      <ChartFrame
        title={copy.topicDistribution.title[locale]}
        subtitle={copy.topicDistribution.subtitle[locale]}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={localizedCharts.topicDistribution} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="localizedLabel"
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
        title={copy.impactTimeline.title[locale]}
        subtitle={copy.impactTimeline.subtitle[locale]}
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
        title={copy.signalRadar.title[locale]}
        subtitle={copy.signalRadar.subtitle[locale]}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={localizedCharts.signalRadar} outerRadius="72%">
            <PolarGrid stroke={GRID} />
            <PolarAngleAxis dataKey="localizedSignal" tick={TICK} />
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
        title={copy.sourceMix.title[locale]}
        subtitle={copy.sourceMix.subtitle[locale]}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={localizedCharts.sourceMix}
            layout="vertical"
            margin={{ top: 8, right: 8, left: 18, bottom: 0 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={TICK} />
            <YAxis type="category" dataKey="localizedType" tick={TICK} width={92} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
            />
            <Bar dataKey="count" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={720}>
              {localizedCharts.sourceMix.map((entry, index) => (
                <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title={copy.valueChainMap.title[locale]}
        subtitle={copy.valueChainMap.subtitle[locale]}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={localizedCharts.valueChainMap} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="localizedValueChain"
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
