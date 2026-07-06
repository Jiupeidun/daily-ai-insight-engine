import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Bot,
  Braces,
  DatabaseZap,
  FileDown,
  Radio,
  Sparkles
} from "lucide-react";
import { ChartSection } from "@/components/dashboard/chart-section";
import type { DashboardCharts } from "@/components/dashboard/chart-types";
import { LocalClock } from "@/components/dashboard/local-clock";
import { NumberPop } from "@/components/dashboard/number-pop";
import { PreferenceControls } from "@/components/dashboard/preference-controls";
import { ReportActions } from "@/components/dashboard/report-actions";
import { getLatestReport } from "@/lib/report-data";
import type { DailyReport } from "@/lib/insight/schema";

export const dynamic = "force-static";

const GITHUB_URL = "https://github.com/Jiupeidun/daily-ai-insight-engine";
const PDF_ENDPOINT = "/api/report/pdf";

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toDashboardCharts(report: DailyReport): DashboardCharts {
  return {
    topicDistribution: report.charts.topicDistribution.map((item) => ({
      topic: asString(item.topic),
      label: asString(item.label),
      count: asNumber(item.count),
      avgImpact: asNumber(item.avgImpact)
    })),
    sourceMix: report.charts.sourceMix.map((item) => ({
      type: asString(item.type).replace("_", " "),
      count: asNumber(item.count)
    })),
    impactTimeline: report.charts.impactTimeline.map((item) => ({
      date: asString(item.date).slice(5),
      count: asNumber(item.count),
      avgImpact: asNumber(item.avgImpact),
      maxImpact: asNumber(item.maxImpact)
    })),
    momentumSignals: report.charts.momentumSignals.map((item) => ({
      signal: asString(item.signal),
      type: asString(item.type),
      recentCount: asNumber(item.recentCount),
      baselineCount: asNumber(item.baselineCount),
      momentumScore: asNumber(item.momentumScore),
      direction: asString(item.direction),
      rationale: asString(item.rationale)
    })),
    signalRadar: report.charts.signalRadar.map((item) => ({
      signal: asString(item.signal),
      value: asNumber(item.value)
    })),
    valueChainMap: report.charts.valueChainMap.map((item) => ({
      valueChain: asString(item.valueChain),
      count: asNumber(item.count)
    }))
  };
}

function TerminalCard({
  title,
  right,
  children,
  className = "",
  bodyClassName = ""
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`terminal-card ${className}`}>
      <header className="terminal-titlebar">
        <div className="terminal-title-left">
          <span className="terminal-dot dot-red" aria-hidden="true" />
          <span className="terminal-dot dot-yellow" aria-hidden="true" />
          <span className="terminal-dot dot-green" aria-hidden="true" />
          <span className="terminal-title">{title}</span>
        </div>
        {right == null ? null : <div className="terminal-title-right">{right}</div>}
      </header>
      <div className={`terminal-card-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function Bilingual({ zh, en }: { zh: string; en: string }) {
  return (
    <>
      <span className="lang-zh">{zh}</span>
      <span className="lang-en">{en}</span>
    </>
  );
}

function Pipeline() {
  const steps = [
    { icon: Radio, zh: "原始新闻", en: "Raw News" },
    { icon: Bot, zh: "LLM 抽取", en: "LLM Extraction" },
    { icon: Braces, zh: "Schema 校验", en: "Schema Validation" },
    { icon: DatabaseZap, zh: "趋势聚合", en: "Trend Aggregation" },
    { icon: Sparkles, zh: "日报生成", en: "Report" },
    { icon: FileDown, zh: "PDF 输出", en: "PDF" }
  ];

  return (
    <div className="pipeline-strip" aria-label="Processing pipeline">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div className="pipeline-chip" key={step.en}>
            <span className="pipeline-chip-icon">
              <Icon aria-hidden="true" size={14} />
            </span>
            <strong>
              <Bilingual zh={step.zh} en={step.en} />
            </strong>
            <small>
              <NumberPop value={String(index + 1).padStart(2, "0")} />
            </small>
          </div>
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  detail
}: {
  label: ReactNode;
  value: string;
  detail: ReactNode;
}) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong className="metric-value">{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AiFeed({ report }: { report: DailyReport }) {
  const articles = [...report.articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <div className="feed-panel">
      {articles.map((article) => (
        <article className="feed-item" key={article.id}>
          <div className="feed-item-meta">
            <span className="feed-kind">{article.sourceTypeNormalized}</span>
            <span>{article.sourceName}</span>
            <time>
              <NumberPop value={article.publishedAt.slice(5, 16).replace("T", " ")} />
            </time>
          </div>
          <h2>{article.title}</h2>
          <p>{article.summary}</p>
          <div className="feed-item-footer">
            <span>
              <Bilingual zh="影响分" en="Impact" />{" "}
              <NumberPop value={article.impact.score} className="feed-score-number" />
            </span>
            <a href={article.url} target="_blank" rel="noreferrer">
              <Bilingual zh="原文" en="Source" />
              <ArrowUpRight aria-hidden="true" size={12} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatRunTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export default function Home() {
  const report = getLatestReport();
  const charts = toDashboardCharts(report);
  const pdfFileName = `AI舆情分析日报-${report.generatedAt.slice(0, 10)}.pdf`;

  return (
    <main className="site-shell">
      <div className="terminal-workspace">
        <TerminalCard
          title="Daily AI Insight Engine"
          className="command-card"
          bodyClassName="command-body"
          right={
            <div className="command-toolbar">
              <PreferenceControls />
              <LocalClock />
            </div>
          }
        >
          <div className="command-copy">
            <div className="eyebrow">
              <Sparkles aria-hidden="true" size={16} />
              <Bilingual zh="AI 舆情信息流" en="AI intelligence stream" />
            </div>
            <h1>
              <Bilingual zh="AI 舆情分析日报" en="Daily AI Insight Report" />
            </h1>
            <p>
              <span className="lang-zh">
                从官方、媒体、社区和研究源采集 AI 信息，生成每日 AI 舆情分析日报。
              </span>
              <span className="lang-en">
                AI news is collected from official, media, community, and research feeds for a
                daily AI intelligence report.
              </span>
            </p>
          </div>
          <ReportActions
            pdfEndpoint={PDF_ENDPOINT}
            githubHref={GITHUB_URL}
            pdfFileName={pdfFileName}
          />
        </TerminalCard>

        <div className="terminal-grid">
          <section className="panel-column panel-column-main">
            <TerminalCard
              title="Processing Pipeline"
              bodyClassName="pipeline-panel"
            >
              <Pipeline />
            </TerminalCard>

            <TerminalCard
              title={<Bilingual zh="AI 可视化分析" en="AI Visual Analysis" />}
              bodyClassName="chart-terminal-body"
            >
              <ChartSection charts={charts} />
            </TerminalCard>
          </section>

          <aside className="panel-column panel-column-right">
            <TerminalCard title={<Bilingual zh="运行状态" en="Run State" />} bodyClassName="metric-panel">
              <Metric
                label={<Bilingual zh="更新" en="Updated" />}
                value={formatRunTime(report.generatedAt)}
                detail={<Bilingual zh="上海时间" en="Asia/Shanghai" />}
              />
              <Metric
                label={<Bilingual zh="来源" en="Sources" />}
                value={String(report.sourceStats.sourceCount)}
                detail={<Bilingual zh="有效信息源" en="active feeds" />}
              />
              <Metric
                label={<Bilingual zh="条目" en="Items" />}
                value={String(report.sourceStats.structuredCount)}
                detail={<Bilingual zh="已生成日报" en="report ready" />}
              />
            </TerminalCard>

            <TerminalCard
              title={<Bilingual zh="AI 信息流" en="AI Feed" />}
              bodyClassName="feed-card-body"
            >
              <AiFeed report={report} />
            </TerminalCard>
          </aside>
        </div>

        <footer className="site-footer">
          <span>© 2026 Kkertin. All rights reserved.</span>
          <span>Contact: kkertin1214@gmail.com</span>
        </footer>
      </div>
    </main>
  );
}
