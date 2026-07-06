import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { ArticleInsight, DailyReport, Language, QualityGate, SourceType, Topic } from "./schema";
import { DailyReportSchema } from "./schema";
import { stableId } from "./normalize";
import { DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL } from "./extract";

type AiReportOptions = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

const AiReportSupportSchema = DailyReportSchema.pick({
  executiveBrief: true,
  topEvents: true,
  deepDives: true,
  trendRadar: true,
  riskOpportunity: true,
  charts: true
});

const TOPIC_LABELS: Record<Topic, string> = {
  frontier_model: "Frontier models",
  ai_infrastructure: "AI infrastructure",
  product_launch: "Product launches",
  research: "Research",
  open_source: "Open source",
  policy_regulation: "Policy and regulation",
  capital_market: "Capital markets",
  safety_security: "Safety and security",
  enterprise_adoption: "Enterprise adoption",
  developer_tools: "Developer tools"
};

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>
  );
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getCoverageWindow(articles: ArticleInsight[]): { start: string; end: string } {
  const dates = articles.map((article) => new Date(article.publishedAt).getTime());
  return {
    start: new Date(Math.min(...dates)).toISOString(),
    end: new Date(Math.max(...dates)).toISOString()
  };
}

function buildQualityGates(articles: ArticleInsight[], rawCount: number): QualityGate[] {
  const sourceCount = unique(articles.map((article) => article.sourceName)).length;
  const aiValidated = articles.filter((article) => article.extractionMeta.method === "ai").length;
  const mixedLanguage = unique(articles.map((article) => article.language)).length > 1;
  const fallbackCount = articles.length - aiValidated;
  const averageConfidence = average(
    articles.map((article) => Math.round(article.canonicalEvent.confidence * 100))
  );

  return [
    {
      name: "Minimum evidence volume",
      status: articles.length >= 10 ? "pass" : "fail",
      value: `${articles.length} structured items`,
      rationale: "The assignment requires at least 10-20 recent AI-related news or information items."
    },
    {
      name: "Source diversity",
      status: sourceCount >= 5 ? "pass" : "warn",
      value: `${sourceCount} sources`,
      rationale: "Multiple source types reduce one-feed bias and make trend judgment more defensible."
    },
    {
      name: "Structured extraction coverage",
      status: rawCount === articles.length ? "pass" : "warn",
      value: `${articles.length}/${rawCount} items validated`,
      rationale: "Every item should pass the schema before it can influence the report."
    },
    {
      name: "Language diversity",
      status: mixedLanguage ? "pass" : "warn",
      value: mixedLanguage ? "mixed language signal" : "single language signal",
      rationale: "The prompt encourages Chinese-English mix where possible; source availability may vary by run."
    },
    {
      name: "AI extraction resilience",
      status: fallbackCount === 0 ? "pass" : "warn",
      value: fallbackCount === 0 ? "AI path validated" : `${fallbackCount} fallback items`,
      rationale: "Fallback is intentional: it keeps the pipeline reproducible when model keys or JSON responses fail."
    },
    {
      name: "Evidence confidence",
      status: averageConfidence >= 70 ? "pass" : "warn",
      value: `${averageConfidence}/100 average confidence`,
      rationale: "Confidence combines source type and evidence density; low confidence should be visible."
    }
  ];
}

function buildTopicDistribution(articles: ArticleInsight[]) {
  const counts = countBy(articles.flatMap((article) => article.taxonomy.topics));
  return Object.entries(counts)
    .map(([topic, count]) => ({
      topic,
      label: TOPIC_LABELS[topic as Topic],
      count,
      avgImpact: average(
        articles
          .filter((article) => article.taxonomy.topics.includes(topic as Topic))
          .map((article) => article.impact.score)
      )
    }))
    .sort((a, b) => Number(b.count) - Number(a.count));
}

function buildSourceMix(articles: ArticleInsight[]) {
  const counts = countBy(articles.map((article) => article.sourceType));
  return Object.entries(counts).map(([type, count]) => ({
    type,
    count
  }));
}

function buildImpactTimeline(articles: ArticleInsight[]) {
  const byDay = new Map<string, ArticleInsight[]>();
  for (const article of articles) {
    const day = article.publishedAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), article]);
  }

  return Array.from(byDay.entries())
    .map(([date, dayArticles]) => ({
      date,
      count: dayArticles.length,
      avgImpact: average(dayArticles.map((article) => article.impact.score)),
      maxImpact: Math.max(...dayArticles.map((article) => article.impact.score))
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildSignalRadar(articles: ArticleInsight[]) {
  return [
    {
      signal: "Novelty",
      value: average(articles.map((article) => article.signals.novelty * 20))
    },
    {
      signal: "Adoption",
      value: average(articles.map((article) => article.signals.adoption * 20))
    },
    {
      signal: "Technical depth",
      value: average(articles.map((article) => article.signals.technicalDepth * 20))
    },
    {
      signal: "Regulatory weight",
      value: average(articles.map((article) => article.signals.regulatoryWeight * 20))
    },
    {
      signal: "Capital intensity",
      value: average(articles.map((article) => article.signals.capitalIntensity * 20))
    }
  ];
}

function buildValueChainMap(articles: ArticleInsight[]) {
  const counts = countBy(articles.flatMap((article) => article.taxonomy.valueChain));
  return Object.entries(counts)
    .map(([valueChain, count]) => ({ valueChain, count }))
    .sort((a, b) => Number(b.count) - Number(a.count));
}

function buildExecutiveBrief(articles: ArticleInsight[]): string {
  const topTopics = buildTopicDistribution(articles).slice(0, 3);
  const topTitles = articles
    .slice(0, 3)
    .map((article) => `「${article.title}」`)
    .join("、");
  const topicText = topTopics.map((topic) => topic.label).join("、");

  return `今日 AI 信息流的主轴集中在 ${topicText}。高分事件包括 ${topTitles}。整体判断：市场注意力仍在从单点模型能力扩散到产品化、算力约束、企业采用和治理问题；真正值得跟踪的不是单篇新闻的热度，而是这些信号是否在同一价值链上互相强化。`;
}

function buildTrendRadar(articles: ArticleInsight[]): DailyReport["trendRadar"] {
  return buildTopicDistribution(articles)
    .slice(0, 6)
    .map((topic) => ({
      theme: topic.topic as Topic,
      intensity: Math.min(100, Number(topic.count) * 16 + Number(topic.avgImpact) / 2),
      direction: Number(topic.avgImpact) >= 75 ? "up" : Number(topic.avgImpact) >= 60 ? "flat" : "down",
      rationale: `${topic.label} appears in ${topic.count} validated items with average impact ${topic.avgImpact}.`
    }));
}

function buildRiskOpportunity(articles: ArticleInsight[]): DailyReport["riskOpportunity"] {
  const top = articles.slice(0, 8);
  const riskArticles = top.filter((article) => article.impact.risks.length > 0);
  const opportunityArticles = top.filter((article) => article.impact.opportunities.length > 0);

  return [
    {
      type: "risk",
      title: "Model and product velocity may outrun governance readiness",
      rationale:
        riskArticles[0]?.impact.risks[0] ??
        "The report contains several safety, privacy, policy, or rollout risks that should be monitored.",
      relatedArticleIds: riskArticles.slice(0, 4).map((article) => article.id)
    },
    {
      type: "opportunity",
      title: "Developer and enterprise workflow layers remain the clearest monetization path",
      rationale:
        opportunityArticles[0]?.impact.opportunities[0] ??
        "The strongest opportunity signals come from tooling, enterprise adoption, and application-layer distribution.",
      relatedArticleIds: opportunityArticles.slice(0, 4).map((article) => article.id)
    }
  ];
}

export function generateDailyReport(articles: ArticleInsight[], rawCount = articles.length): DailyReport {
  if (articles.length === 0) {
    throw new Error("Cannot generate a report without structured articles.");
  }

  const now = new Date().toISOString();
  const reportId = stableId(`report:${now}:${articles.map((article) => article.id).join(":")}`);
  const sourceTypes = countBy(articles.map((article) => article.sourceType));
  const languages = countBy(articles.map((article) => article.language));
  const coverageWindow = getCoverageWindow(articles);

  const report = {
    id: reportId,
    title: "AI 舆情分析日报",
    generatedAt: now,
    coverageWindow,
    sourceStats: {
      rawCount,
      structuredCount: articles.length,
      sourceCount: unique(articles.map((article) => article.sourceName)).length,
      languageMix: {
        zh: languages.zh ?? 0,
        en: languages.en ?? 0,
        mixed: languages.mixed ?? 0
      } satisfies Record<Language, number>,
      sourceTypeMix: {
        tech_media: sourceTypes.tech_media ?? 0,
        official: sourceTypes.official ?? 0,
        research: sourceTypes.research ?? 0,
        developer: sourceTypes.developer ?? 0,
        aggregator: sourceTypes.aggregator ?? 0,
        social: sourceTypes.social ?? 0
      } satisfies Record<SourceType, number>
    },
    schemaRationale: [
      "The schema separates raw article facts from extracted event judgment so claims remain traceable to sources.",
      "Taxonomy fields make cross-source aggregation possible; the report can count themes instead of stitching summaries.",
      "Impact fields encode horizon, stakeholders, risks, and opportunities because a daily report should support decisions.",
      "Extraction metadata records AI/fallback method, prompt version, validation time, and warnings for auditability."
    ],
    qualityGates: buildQualityGates(articles, rawCount),
    executiveBrief: buildExecutiveBrief(articles),
    topEvents: articles.slice(0, 5).map((article, index) => ({
      rank: index + 1,
      articleId: article.id,
      title: article.title,
      score: article.impact.score,
      whyImportant: article.canonicalEvent.whyItMatters,
      evidence: article.canonicalEvent.evidence,
      url: article.url
    })),
    deepDives: articles.slice(0, 3).map((article) => ({
      articleId: article.id,
      headline: article.title,
      background: article.canonicalEvent.whatHappened,
      impact: article.canonicalEvent.whyItMatters,
      watchNext: `Watch whether ${article.impact.stakeholders.slice(0, 2).join(" and ")} convert this signal into measurable adoption, regulation, or platform shifts over the next ${article.impact.horizon}.`,
      citedUrls: [article.url]
    })),
    trendRadar: buildTrendRadar(articles),
    riskOpportunity: buildRiskOpportunity(articles),
    charts: {
      topicDistribution: buildTopicDistribution(articles),
      sourceMix: buildSourceMix(articles),
      impactTimeline: buildImpactTimeline(articles),
      signalRadar: buildSignalRadar(articles),
      valueChainMap: buildValueChainMap(articles)
    },
    articles,
    methodology: [
      {
        step: "Source selection",
        detail:
          "RSS feeds are chosen from official, media, developer, research, and aggregator sources to balance freshness and credibility."
      },
      {
        step: "Normalize and dedupe",
        detail:
          "HTML is stripped, timestamps are normalized to ISO, URLs are canonicalized, and repeated links are removed before extraction."
      },
      {
        step: "Batch extraction",
        detail:
          "Articles are processed in small batches; AI output must pass Zod validation or the deterministic extractor takes over."
      },
      {
        step: "Structured aggregation",
        detail:
          "Daily report sections are generated from validated schema fields, not from raw article text."
      },
      {
        step: "Quality gates",
        detail:
          "The output exposes source diversity, extraction coverage, language mix, fallback count, and evidence confidence."
      }
    ]
  };

  return DailyReportSchema.parse(report);
}

function buildReportSynthesisPrompt(baseline: DailyReport) {
  const articleBriefs = baseline.articles.slice(0, 18).map((article) => ({
    articleId: article.id,
    title: article.title,
    url: article.url,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    topics: article.taxonomy.topics,
    valueChain: article.taxonomy.valueChain,
    score: article.impact.score,
    event: article.canonicalEvent.whatHappened,
    evidence: article.canonicalEvent.evidence,
    whyItMatters: article.canonicalEvent.whyItMatters,
    signals: article.signals,
    risks: article.impact.risks,
    opportunities: article.impact.opportunities
  }));

  return [
    "You are generating the final support data for a daily AI public-opinion intelligence dashboard and PDF report.",
    "Return only valid JSON. Do not include markdown.",
    "Use only the provided article facts and articleIds. Do not invent URLs, sources, entities, dates, or events.",
    "Write executiveBrief, rationale, impact, watchNext, risks, and opportunities in Chinese.",
    "Generate the entire report support payload: executiveBrief, topEvents, deepDives, trendRadar, riskOpportunity, and charts.",
    "The charts object must contain topicDistribution, sourceMix, impactTimeline, signalRadar, and valueChainMap arrays. Chart rows may contain string and number fields only.",
    "topEvents must use exactly 5 items. deepDives must use exactly 3 items. trendRadar should use 4-6 themes.",
    "Expected JSON shape: {\"executiveBrief\": string, \"topEvents\": [...], \"deepDives\": [...], \"trendRadar\": [...], \"riskOpportunity\": [...], \"charts\": {...}}.",
    JSON.stringify(
      {
        allowedThemes: Object.keys(TOPIC_LABELS),
        baselineSupportData: AiReportSupportSchema.parse(baseline),
        articles: articleBriefs
      },
      null,
      2
    )
  ].join("\n\n");
}

async function synthesizeReportWithVercelAiSdk(baseline: DailyReport, options: AiReportOptions) {
  if (!options.apiKey) {
    throw new Error("AI_API_KEY is required for AI report synthesis.");
  }

  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl ?? DEFAULT_OPENAI_BASE_URL
  });

  const result = await generateObject({
    model: provider(options.model ?? DEFAULT_OPENAI_MODEL),
    schema: AiReportSupportSchema,
    temperature: 0.2,
    system:
      "You are a strict daily AI intelligence report synthesis system. Return schema-valid report support data only.",
    prompt: buildReportSynthesisPrompt(baseline)
  });

  return result.object;
}

export async function generateDailyReportWithAiSupport(
  articles: ArticleInsight[],
  rawCount = articles.length,
  options: AiReportOptions = {}
): Promise<DailyReport> {
  const baseline = generateDailyReport(articles, rawCount);

  if (options.provider !== "openai_compatible" || !options.apiKey) {
    return baseline;
  }

  try {
    const aiSupport = await synthesizeReportWithVercelAiSdk(baseline, options);
    return DailyReportSchema.parse({
      ...baseline,
      ...aiSupport,
      schemaRationale: [
        ...baseline.schemaRationale,
        "Daily report support data is synthesized by OpenAI from validated article-level insights, then revalidated before rendering."
      ],
      qualityGates: [
        ...baseline.qualityGates,
        {
          name: "AI report synthesis",
          status: "pass",
          value: `${options.model ?? DEFAULT_OPENAI_MODEL} generated support data`,
          rationale:
            "Executive brief, top events, deep dives, trend radar, risk/opportunity framing, and chart datasets were generated by the model from validated article facts."
        }
      ],
      articles: baseline.articles,
      methodology: baseline.methodology.map((item) =>
        item.step === "Structured aggregation"
          ? {
              ...item,
              detail:
                "OpenAI synthesizes final dashboard and PDF support data from validated schema fields; code then revalidates and renders it."
            }
          : item
      )
    });
  } catch (error) {
    const warning = error instanceof Error ? error.message : String(error);
    return DailyReportSchema.parse({
      ...baseline,
      qualityGates: [
        ...baseline.qualityGates,
        {
          name: "AI report synthesis",
          status: "warn",
          value: "fallback report support data",
          rationale: warning
        }
      ]
    });
  }
}

export { TOPIC_LABELS };
