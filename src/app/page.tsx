import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  FileJson2,
  GitBranch,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { ChartSection } from "@/components/dashboard/chart-section";
import type { DashboardCharts } from "@/components/dashboard/chart-types";
import { TOPIC_LABELS } from "@/lib/insight/report";
import { getLatestReport } from "@/lib/report-data";
import type { DailyReport } from "@/lib/insight/schema";

export const dynamic = "force-static";

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function MetricTile({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
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
              <Icon aria-hidden="true" size={18} />
              <span>{STATUS_LABEL[gate.status]}</span>
            </div>
            <h3>{gate.name}</h3>
            <strong>{gate.value}</strong>
            <p>{gate.rationale}</p>
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
          <div>
            <div className="event-title-line">
              <h3>{event.title}</h3>
              <span>{event.score}</span>
            </div>
            <p>{event.whyImportant}</p>
            <p className="evidence">{event.evidence}</p>
            <a href={event.url} target="_blank" rel="noreferrer">
              Source <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function DeepDives({ report }: { report: DailyReport }) {
  return (
    <div className="deep-dive-grid">
      {report.deepDives.map((item) => (
        <article className="deep-dive" key={item.articleId}>
          <h3>{item.headline}</h3>
          <dl>
            <dt>Background</dt>
            <dd>{item.background}</dd>
            <dt>Impact</dt>
            <dd>{item.impact}</dd>
            <dt>Watch next</dt>
            <dd>{item.watchNext}</dd>
          </dl>
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

function StructuredTable({ report }: { report: DailyReport }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Topics</th>
            <th>Source</th>
            <th>Impact</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          {report.articles.map((article) => (
            <tr key={article.id}>
              <td>
                <strong>{article.title}</strong>
                <span>{article.canonicalEvent.whatHappened}</span>
              </td>
              <td>{article.taxonomy.topics.map((topic) => TOPIC_LABELS[topic]).join(", ")}</td>
              <td>{article.sourceName}</td>
              <td>{article.impact.score}</td>
              <td>{article.extractionMeta.method}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Methodology({ report }: { report: DailyReport }) {
  return (
    <div className="method-grid">
      {report.methodology.map((item, index) => (
        <div className="method-step" key={item.step}>
          <span>{index + 1}</span>
          <h3>{item.step}</h3>
          <p>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const report = getLatestReport();
  const charts = toDashboardCharts(report);
  const fallbackItems = report.articles.filter(
    (article) => article.extractionMeta.method === "deterministic_fallback"
  ).length;

  return (
    <main>
      <section className="overview-band">
        <div className="page-shell overview-grid">
          <div className="overview-copy">
            <div className="eyebrow">
              <Sparkles aria-hidden="true" size={16} />
              Daily AI Insight Engine
            </div>
            <h1>AI 舆情分析日报</h1>
            <p>{report.executiveBrief}</p>
            <div className="overview-actions" aria-label="Repository actions">
              <a className="button-link primary" href="/api/report">
                <FileJson2 aria-hidden="true" size={16} />
                Report JSON
              </a>
              <a className="button-link" href="https://github.com/Jiupeidun/daily-ai-insight-engine">
                <GitBranch aria-hidden="true" size={16} />
                GitHub
              </a>
            </div>
          </div>

          <div className="metric-panel" aria-label="Report coverage summary">
            <MetricTile
              label="Structured Items"
              value={String(report.sourceStats.structuredCount)}
              detail={`${report.sourceStats.sourceCount} sources`}
            />
            <MetricTile
              label="Coverage"
              value={`${formatDate(report.coverageWindow.start)}-${formatDate(report.coverageWindow.end)}`}
              detail={`generated ${formatDateTime(report.generatedAt)}`}
            />
            <MetricTile
              label="Language Mix"
              value={`${report.sourceStats.languageMix.zh + report.sourceStats.languageMix.mixed}/${report.sourceStats.structuredCount}`}
              detail="Chinese or mixed-language items"
            />
            <MetricTile
              label="Fallbacks"
              value={String(fallbackItems)}
              detail="validated deterministic extraction"
            />
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="page-shell section-heading">
          <div>
            <span className="section-kicker">
              <ShieldCheck aria-hidden="true" size={16} />
              Quality Gates
            </span>
            <h2>先看数据是否值得信任</h2>
          </div>
          <p>
            The report exposes volume, diversity, validation coverage, language mix, fallback usage, and evidence confidence before making claims.
          </p>
        </div>
        <div className="page-shell">
          <QualityGateList report={report} />
        </div>
      </section>

      <section className="section-band tinted">
        <div className="page-shell section-heading">
          <div>
            <span className="section-kicker">
              <Activity aria-hidden="true" size={16} />
              Visual Analysis
            </span>
            <h2>从结构化字段生成可视化</h2>
          </div>
          <p>
            Charts are rendered from validated schema fields only; raw text never drives the visualization layer directly.
          </p>
        </div>
        <div className="page-shell">
          <ChartSection charts={charts} />
        </div>
      </section>

      <section className="section-band">
        <div className="page-shell content-grid">
          <div>
            <span className="section-kicker">
              <Cloud aria-hidden="true" size={16} />
              Top Events
            </span>
            <h2>今日主要热点</h2>
            <TopEvents report={report} />
          </div>
          <aside>
            <span className="section-kicker">
              <Database aria-hidden="true" size={16} />
              Trend Radar
            </span>
            <h2>趋势判断</h2>
            <TrendRadar report={report} />
          </aside>
        </div>
      </section>

      <section className="section-band tinted">
        <div className="page-shell section-heading">
          <div>
            <span className="section-kicker">Deep Dives</span>
            <h2>重要事件深度总结</h2>
          </div>
        </div>
        <div className="page-shell">
          <DeepDives report={report} />
        </div>
      </section>

      <section className="section-band">
        <div className="page-shell section-heading">
          <div>
            <span className="section-kicker">Schema</span>
            <h2>结构化抽取结果</h2>
          </div>
          <p>{report.schemaRationale.join(" ")}</p>
        </div>
        <div className="page-shell">
          <StructuredTable report={report} />
        </div>
      </section>

      <section className="section-band final-band">
        <div className="page-shell section-heading">
          <div>
            <span className="section-kicker">Pipeline</span>
            <h2>处理流程与设计决策</h2>
          </div>
        </div>
        <div className="page-shell">
          <Methodology report={report} />
        </div>
      </section>
    </main>
  );
}
