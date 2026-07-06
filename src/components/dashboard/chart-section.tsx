"use client";

import dynamic from "next/dynamic";
import type { DashboardCharts } from "./chart-types";

const ChartsPanel = dynamic(
  () => import("./charts-panel").then((module) => module.ChartsPanel),
  {
    ssr: false,
    loading: () => (
      <div className="charts-loading" aria-label="Loading charts">
        <span />
        <span />
        <span />
      </div>
    )
  }
);

export function ChartSection({ charts }: { charts: DashboardCharts }) {
  return <ChartsPanel charts={charts} />;
}
