import type { ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  FileJson2,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { ChartSection } from "@/components/dashboard/chart-section";
import type { DashboardCharts } from "@/components/dashboard/chart-types";
import { LocalClock } from "@/components/dashboard/local-clock";
import { PreferenceControls } from "@/components/dashboard/preference-controls";
import { ReportActions } from "@/components/dashboard/report-actions";
import {
  StructuredExtractionList,
  type ExtractionListRow
} from "@/components/dashboard/structured-extraction-list";
import { TOPIC_LABELS } from "@/lib/insight/report";
import { getLatestReport } from "@/lib/report-data";
import type { DailyReport } from "@/lib/insight/schema";

export const dynamic = "force-static";

const GITHUB_URL = "https://github.com/Jiupeidun/daily-ai-insight-engine";
const PDF_ENDPOINT = "/api/report/pdf";

const STATUS_LABEL = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL"
};

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

function toExtractionRows(report: DailyReport): ExtractionListRow[] {
  return report.articles.map((article) => ({
    id: article.id,
    title: article.title,
    event: article.canonicalEvent.whatHappened,
    source: article.sourceName,
    topics: article.taxonomy.topics.map((topic) => TOPIC_LABELS[topic]).join(", "),
    impact: article.impact.score,
    method: article.extractionMeta.method
  }));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
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

function MetricTile({
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
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function QualityGateList({ report }: { report: DailyReport }) {
  return (
    <div className="quality-grid">
      {report.qualityGates.map((gate) => {
        const Icon = gate.status === "pass" ? CheckCircle2 : CircleAlert;
        return (
          <div className={`quality-card ${gate.status}`} key={gate.name}>
            <div className="quality-card-top">
              <Icon aria-hidden="true" size={16} />
              <span>{STATUS_LABEL[gate.status]}</span>
            </div>
            <div>
              <h3>{gate.name}</h3>
              <strong>{gate.value}</strong>
              <p>{gate.rationale}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopEvents({ report }: { report: DailyReport }) {
  return (
    <div className="event-list">
      {report.topEvents.map((event) => (
        <article className="event-row" key={event.articleId}>
          <div className="event-rank">{event.rank}</div>
          <div className="event-body">
            <div className="event-title-line">
              <h3>{event.title}</h3>
              <span>{event.score}</span>
            </div>
            <p>{event.whyImportant}</p>
            <p className="evidence">{event.evidence}</p>
            <a href={event.url} target="_blank" rel="noreferrer">
              <Bilingual zh="来源" en="Source" /> <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function TrendRadar({ report }: { report: DailyReport }) {
  return (
    <div className="trend-list">
      {report.trendRadar.map((trend) => (
        <div className="trend-row" key={trend.theme}>
          <div>
            <strong>{TOPIC_LABELS[trend.theme]}</strong>
            <span>{trend.rationale}</span>
          </div>
          <div className="trend-score">
            <span>{trend.direction}</span>
            <strong>{Math.round(trend.intensity)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProcessingPipeline() {
  const steps = [
    { zh: "原始新闻", en: "Raw News" },
    { zh: "结构化 JSON", en: "Structured JSON" },
    { zh: "Schema 校验", en: "Schema Validation" },
    { zh: "趋势聚合", en: "Trend Aggregation" },
    { zh: "日报生成", en: "Report" },
    { zh: "PDF 输出", en: "PDF" }
  ];

  return (
    <div className="pipeline-flow" aria-label="Processing Pipeline">
      {steps.map((step, index) => (
        <div className="pipeline-node" key={step.en}>
          <div className="pipeline-node-index">{index + 1}</div>
          <div>
            <strong>
              <Bilingual zh={step.zh} en={step.en} />
            </strong>
            <span>
              {index < steps.length - 1 ? (
                <Bilingual zh="通过校验后进入下一步" en="validated before next step" />
              ) : (
                <Bilingual zh="点击按钮实时生成" en="generated on demand" />
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SchemaDesignPanel({ report }: { report: DailyReport }) {
  const first = report.articles[0];
  const fields = [
    ["category", first.category],
    ["event_type", first.eventType],
    ["entities", String(first.entities.extracted.length)],
    ["key_facts", String(first.keyFacts.length)],
    ["importance", `${first.importanceScore}/5`],
    ["confidence", first.confidenceScore.toFixed(2)]
  ];

  return (
    <div className="schema-panel">
      <div className="schema-panel-head">
        <FileJson2 aria-hidden="true" size={15} />
        <span>NewsInsightSchema</span>
      </div>
      <div className="schema-field-grid">
        {fields.map(([field, value]) => (
          <div className="schema-field" key={field}>
            <span>{field}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const report = getLatestReport();
  const charts = toDashboardCharts(report);
  const extractionRows = toExtractionRows(report);
  const fallbackItems = report.articles.filter(
    (article) => article.extractionMeta.method === "deterministic_fallback"
  ).length;
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
              <span className="status-pill">
                <ShieldCheck aria-hidden="true" size={14} />
                <Bilingual zh="Schema 已验证" en="Schema verified" />
              </span>
              <LocalClock />
            </div>
          }
        >
          <div className="command-copy">
            <div className="eyebrow">
              <Sparkles aria-hidden="true" size={16} />
              <Bilingual zh="AI 应用情报" en="AI Application Intelligence" />
            </div>
            <h1>
              <Bilingual zh="AI 舆情分析日报" en="Daily AI Insight Report" />
            </h1>
            <p>
              <span className="lang-zh">{report.executiveBrief}</span>
              <span className="lang-en">
                A reproducible daily AI intelligence dashboard with validated sources, schema-first
                extraction, trend scoring, and a downloadable PDF report for the current run.
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
          <aside className="panel-column panel-column-left">
            <TerminalCard
              title={<Bilingual zh="覆盖范围" en="Coverage" />}
              bodyClassName="metric-panel"
            >
              <MetricTile
                label={<Bilingual zh="结构化" en="Structured" />}
                value={String(report.sourceStats.structuredCount)}
                detail={`${report.sourceStats.sourceCount} sources`}
              />
              <MetricTile
                label={<Bilingual zh="窗口" en="Window" />}
                value={`${formatDate(report.coverageWindow.start)}-${formatDate(report.coverageWindow.end)}`}
                detail={<Bilingual zh="覆盖区间" en="coverage range" />}
              />
              <MetricTile
                label={<Bilingual zh="中/混合" en="ZH / Mixed" />}
                value={`${report.sourceStats.languageMix.zh + report.sourceStats.languageMix.mixed}/${report.sourceStats.structuredCount}`}
                detail={<Bilingual zh="语言组合" en="language mix" />}
              />
              <MetricTile
                label={<Bilingual zh="兜底" en="Fallbacks" />}
                value={String(fallbackItems)}
                detail={<Bilingual zh="非 AI 条目" en="non-AI items" />}
              />
            </TerminalCard>

            <TerminalCard title="Processing Pipeline" bodyClassName="pipeline-panel">
              <ProcessingPipeline />
            </TerminalCard>

            <TerminalCard title={<Bilingual zh="核心 Schema" en="Core Schema" />} bodyClassName="schema-card-body">
              <SchemaDesignPanel report={report} />
            </TerminalCard>
          </aside>

          <section className="panel-column panel-column-main">
            <TerminalCard
              title={<Bilingual zh="可视化分析" en="Visual Analysis" />}
              bodyClassName="chart-terminal-body"
              right={
                <span className="mini-label">
                  <Activity aria-hidden="true" size={13} />
                  <Bilingual zh="OpenAI 支撑" en="OpenAI-backed" />
                </span>
              }
            >
              <ChartSection charts={charts} />
            </TerminalCard>

            <TerminalCard
              title={<Bilingual zh="质量门" en="Quality Gates" />}
              bodyClassName="virtual-card-body"
            >
              <QualityGateList report={report} />
            </TerminalCard>
          </section>

          <aside className="panel-column panel-column-right">
            <TerminalCard
              title={<Bilingual zh="今日热点" en="Top Events" />}
              bodyClassName="scroll-panel"
              right={
                <span className="mini-label">
                  <Cloud aria-hidden="true" size={13} />
                  <Bilingual zh="按影响排序" en="ranked by impact" />
                </span>
              }
            >
              <TopEvents report={report} />
            </TerminalCard>

            <TerminalCard
              title={<Bilingual zh="趋势雷达" en="Trend Radar" />}
              bodyClassName="scroll-panel"
              right={
                <span className="mini-label">
                  <Database aria-hidden="true" size={13} />
                  <Bilingual zh="信号强度" en="signal strength" />
                </span>
              }
            >
              <TrendRadar report={report} />
            </TerminalCard>

            <TerminalCard title={<Bilingual zh="结构化抽取" en="Structured Extraction" />} bodyClassName="virtual-card-body">
              <StructuredExtractionList rows={extractionRows} />
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
