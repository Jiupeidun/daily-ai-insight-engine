import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ArticleInsight, DailyReport, Language, QualityGate, SourceType, Topic } from "./schema";
import { DailyReportSchema, REPORT_SCHEMA_VERSION, SCORING_VERSION } from "./schema";
import { stableId } from "./normalize";
import { DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL } from "./extract";

type AiReportOptions = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

const AiReportSupportSchema = z.object({
  executiveBrief: z.string().min(40),
  topEvents: z.array(
    z.object({
      rank: z.number().int().positive(),
      articleId: z.string(),
      title: z.string(),
      score: z.number().int().min(0).max(100),
      whyImportant: z.string(),
      evidence: z.string(),
      url: z.string()
    })
  ),
  deepDives: z.array(
    z.object({
      articleId: z.string(),
      headline: z.string(),
      background: z.string(),
      impact: z.string(),
      watchNext: z.string(),
      citedUrls: z.array(z.string())
    })
  ),
  trendRadar: z.array(
    z.object({
      theme: z.enum([
        "frontier_model",
        "ai_infrastructure",
        "product_launch",
        "research",
        "open_source",
        "policy_regulation",
        "capital_market",
        "safety_security",
        "enterprise_adoption",
        "developer_tools"
      ]),
      intensity: z.number().int().min(0).max(100),
      direction: z.enum(["up", "flat", "down"]),
      rationale: z.string()
    })
  ),
  riskOpportunity: z.array(
    z.object({
      type: z.enum(["risk", "opportunity"]),
      title: z.string(),
      rationale: z.string(),
      relatedArticleIds: z.array(z.string())
    })
  ),
  charts: z.object({
    topicDistribution: z.array(
      z.object({
        topic: z.string(),
        label: z.string(),
        count: z.number(),
        avgImpact: z.number()
      })
    ),
    sourceMix: z.array(
      z.object({
        type: z.string(),
        count: z.number()
      })
    ),
    impactTimeline: z.array(
      z.object({
        date: z.string(),
        count: z.number(),
        avgImpact: z.number(),
        maxImpact: z.number()
      })
    ),
    momentumSignals: z.array(
      z.object({
        signal: z.string(),
        type: z.string(),
        recentCount: z.number(),
        baselineCount: z.number(),
        momentumScore: z.number(),
        direction: z.enum(["rising", "stable", "cooling"]),
        rationale: z.string()
      })
    ).default([]),
    signalRadar: z.array(
      z.object({
        signal: z.string(),
        value: z.number()
      })
    ),
    valueChainMap: z.array(
      z.object({
        valueChain: z.string(),
        count: z.number()
      })
    )
  })
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

function clampReportScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
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
  const coreRelevanceCount = articles.filter((article) => article.aiRelevance.tier === "core").length;
  const adjacentRelevanceCount = articles.filter((article) => article.aiRelevance.tier === "adjacent").length;
  const noiseRelevanceCount = articles.filter((article) => article.aiRelevance.tier === "noise").length;
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
      value: fallbackCount === 0 ? "AI path validated" : `${fallbackCount} non-AI items`,
      rationale:
        "OpenAI-compatible extraction runs in concurrent batches and retries malformed large batches by splitting them before validation."
    },
    {
      name: "Evidence confidence",
      status: averageConfidence >= 70 ? "pass" : "warn",
      value: `${averageConfidence}/100 average confidence`,
      rationale: "Confidence combines source type and evidence density; low confidence should be visible."
    },
    {
      name: "AI relevance gate",
      status: coreRelevanceCount >= 10 ? "pass" : coreRelevanceCount >= 5 ? "warn" : "fail",
      value: `${coreRelevanceCount} core / ${adjacentRelevanceCount} adjacent / ${noiseRelevanceCount} noise`,
      rationale:
        "Only core AI signals are eligible for the main Top Events ranking; adjacent and noise items can support context but cannot dominate the report."
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

function buildMomentumSignals(articles: ArticleInsight[]) {
  const eligible = articles.filter((article) => article.aiRelevance.tier !== "noise");
  if (eligible.length === 0) {
    return [];
  }

  const latestTimestamp = Math.max(...eligible.map((article) => new Date(article.publishedAt).getTime()));
  const recentWindowMs = 48 * 60 * 60 * 1000;
  const recentStart = latestTimestamp - recentWindowMs;
  const rows = new Map<
    string,
    {
      signal: string;
      type: "topic" | "entity";
      recent: ArticleInsight[];
      baseline: ArticleInsight[];
    }
  >();

  function addSignal(signal: string, type: "topic" | "entity", article: ArticleInsight) {
    const key = `${type}:${signal}`;
    const existing = rows.get(key) ?? { signal, type, recent: [], baseline: [] };
    const bucket = new Date(article.publishedAt).getTime() >= recentStart ? existing.recent : existing.baseline;
    bucket.push(article);
    rows.set(key, existing);
  }

  for (const article of eligible) {
    for (const topic of article.taxonomy.topics) {
      addSignal(topic, "topic", article);
    }
    for (const organization of article.entities.organizations.slice(0, 4)) {
      if (organization !== "AI ecosystem") {
        addSignal(organization, "entity", article);
      }
    }
  }

  return Array.from(rows.values())
    .map((row) => {
      const recentCount = row.recent.length;
      const baselineCount = row.baseline.length;
      const recentImpact = average(row.recent.map((article) => article.impact.score));
      const baselineImpact = average(row.baseline.map((article) => article.impact.score));
      const expectedRecentCount = baselineCount / 3 + 1;
      const acceleration = recentCount / expectedRecentCount;
      const accelerationScore = clampReportScore(50 + Math.log2(Math.max(0.25, acceleration)) * 18);
      const volumeScore = clampReportScore(Math.log1p(recentCount) * 28);
      const impactScore = recentImpact > 0 ? recentImpact : baselineImpact;
      const momentumScore = clampReportScore(
        accelerationScore * 0.45 + volumeScore * 0.3 + impactScore * 0.25
      );
      const direction = momentumScore >= 72 ? "rising" : momentumScore <= 48 ? "cooling" : "stable";

      return {
        signal: row.signal,
        type: row.type,
        recentCount,
        baselineCount,
        momentumScore,
        direction,
        rationale: `${row.signal} has ${recentCount} recent validated items against an expected recent baseline of ${expectedRecentCount.toFixed(1)}, with average impact ${recentImpact}.`
      };
    })
    .filter((row) => row.recentCount > 0 || row.baselineCount > 1)
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 8);
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
  const topTitles = [...articles]
    .sort((a, b) => {
      if (a.aiRelevance.tier !== b.aiRelevance.tier) {
        const order = { core: 0, adjacent: 1, noise: 2 };
        return order[a.aiRelevance.tier] - order[b.aiRelevance.tier];
      }
      return b.impact.score - a.impact.score;
    })
    .slice(0, 3)
    .map((article) => `"${article.title}"`)
    .join(", ");
  const topicText = topTopics.map((topic) => topic.label).join(", ");

  return `Today's AI intelligence flow is concentrated around ${topicText}. The highest-ranked events include ${topTitles}. Overall, market attention is moving from isolated model capability toward productization, compute constraints, enterprise adoption, and governance. The most important signal is whether these events reinforce one another across the AI value chain.`;
}

function buildTrendRadar(articles: ArticleInsight[]): DailyReport["trendRadar"] {
  const momentumByTopic = new Map(
    buildMomentumSignals(articles)
      .filter((signal) => signal.type === "topic")
      .map((signal) => [signal.signal, signal])
  );

  return buildTopicDistribution(articles)
    .slice(0, 6)
    .map((topic) => {
      const momentum = momentumByTopic.get(topic.topic);
      const intensity = Math.min(
        100,
        Number(topic.count) * 12 + Number(topic.avgImpact) / 2 + (momentum?.momentumScore ?? 50) / 5
      );
      const direction = momentum
        ? momentum.direction === "rising"
          ? "up"
          : momentum.direction === "cooling"
            ? "down"
            : "flat"
        : Number(topic.avgImpact) >= 75
          ? "up"
          : Number(topic.avgImpact) >= 60
            ? "flat"
            : "down";

      return {
        theme: topic.topic as Topic,
        intensity: Math.round(intensity),
        direction,
        rationale: momentum
          ? `${topic.label} momentum is ${momentum.direction}: ${momentum.recentCount} recent mentions versus ${momentum.baselineCount} baseline mentions.`
          : `${topic.label} appears in ${topic.count} validated items with average impact ${topic.avgImpact}.`
      };
    });
}

function buildRiskOpportunity(articles: ArticleInsight[]): DailyReport["riskOpportunity"] {
  const top = [...articles]
    .sort((a, b) => b.impact.score - a.impact.score)
    .slice(0, 8);
  const infrastructureArticles = top.filter(
    (article) =>
      article.taxonomy.valueChain.includes("compute") ||
      article.taxonomy.valueChain.includes("market") ||
      article.taxonomy.topics.includes("ai_infrastructure") ||
      article.taxonomy.topics.includes("capital_market")
  );
  const governanceArticles = top.filter(
    (article) =>
      article.taxonomy.valueChain.includes("governance") ||
      article.taxonomy.topics.includes("policy_regulation") ||
      article.taxonomy.topics.includes("safety_security")
  );
  const applicationArticles = top.filter(
    (article) =>
      article.taxonomy.valueChain.includes("application") ||
      article.taxonomy.valueChain.includes("tooling") ||
      article.taxonomy.topics.includes("enterprise_adoption") ||
      article.taxonomy.topics.includes("developer_tools")
  );
  const riskArticles = [...governanceArticles, ...infrastructureArticles, ...top].filter(
    (article, index, list) => article.impact.risks.length > 0 && list.findIndex((candidate) => candidate.id === article.id) === index
  );
  const opportunityArticles = [...applicationArticles, ...infrastructureArticles, ...top].filter(
    (article, index, list) =>
      article.impact.opportunities.length > 0 && list.findIndex((candidate) => candidate.id === article.id) === index
  );

  return [
    {
      type: "risk",
      title: "Infrastructure and agent governance can become near-term bottlenecks",
      rationale:
        riskArticles[0]
          ? `${riskArticles[0].impact.risks[0]} The risk is amplified when AI adoption depends on scarce compute, autonomous agents, security controls, or policy-sensitive applications.`
          : "The main risk is that model and product velocity outruns infrastructure availability, agent security controls, or regulatory readiness.",
      relatedArticleIds: riskArticles.length > 0 ? riskArticles.slice(0, 4).map((article) => article.id) : top.slice(0, 4).map((article) => article.id)
    },
    {
      type: "opportunity",
      title: "Enterprise workflows and AI infrastructure remain the clearest monetization paths",
      rationale:
        opportunityArticles[0]
          ? `${opportunityArticles[0].impact.opportunities[0]} The opportunity is strongest where validated AI capability can be packaged into workflow software, developer tooling, data platforms, or infrastructure supply.`
          : "The strongest opportunity signals come from products that turn model capability into governed workflows, developer productivity, infrastructure leverage, or enterprise adoption.",
      relatedArticleIds:
        opportunityArticles.length > 0 ? opportunityArticles.slice(0, 4).map((article) => article.id) : top.slice(0, 4).map((article) => article.id)
    }
  ];
}

export function generateDailyReport(articles: ArticleInsight[], rawCount = articles.length): DailyReport {
  if (articles.length === 0) {
    throw new Error("Cannot generate a report without structured articles.");
  }

  const now = new Date().toISOString();
  const reportId = stableId(`report:${now}:${articles.map((article) => article.id).join(":")}`);
  const insightArticles = articles.filter((article) => article.aiRelevance.tier !== "noise");
  const aggregationArticles = insightArticles.length >= 5 ? insightArticles : articles;
  const impactRankedArticles = [...articles].sort((a, b) => {
    if (b.impact.score !== a.impact.score) {
      return b.impact.score - a.impact.score;
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  const coreRankedArticles = impactRankedArticles.filter(
    (article) => article.aiRelevance.tier === "core"
  );
  const adjacentRankedArticles = impactRankedArticles.filter(
    (article) => article.aiRelevance.tier === "adjacent"
  );
  const topEventCandidates = [
    ...coreRankedArticles,
    ...adjacentRankedArticles,
    ...impactRankedArticles.filter((article) => article.aiRelevance.tier === "noise")
  ];
  const sourceTypes = countBy(articles.map((article) => article.sourceType));
  const languages = countBy(articles.map((article) => article.language));
  const coverageWindow = getCoverageWindow(articles);

  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    scoringVersion: SCORING_VERSION,
    id: reportId,
    title: "Daily AI Insight Report",
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
        financial: sourceTypes.financial ?? 0,
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
    executiveBrief: buildExecutiveBrief(aggregationArticles),
    topEvents: topEventCandidates.slice(0, 5).map((article, index) => ({
      rank: index + 1,
      articleId: article.id,
      title: article.title,
      score: article.impact.score,
      whyImportant:
        article.aiRelevance.tier === "core"
          ? article.canonicalEvent.whyItMatters
          : `${article.canonicalEvent.whyItMatters} This item is marked ${article.aiRelevance.tier} by the AI relevance gate.`,
      evidence: article.canonicalEvent.evidence,
      url: article.url
    })),
    deepDives: topEventCandidates.slice(0, 3).map((article) => ({
      articleId: article.id,
      headline: article.title,
      background: article.canonicalEvent.whatHappened,
      impact: article.canonicalEvent.whyItMatters,
      watchNext: `Watch whether ${article.impact.stakeholders.slice(0, 2).join(" and ")} convert this signal into measurable adoption, regulation, or platform shifts over the next ${article.impact.horizon}.`,
      citedUrls: [article.url]
    })),
    trendRadar: buildTrendRadar(aggregationArticles),
    riskOpportunity: buildRiskOpportunity(aggregationArticles),
    charts: {
      topicDistribution: buildTopicDistribution(aggregationArticles),
      sourceMix: buildSourceMix(articles),
      impactTimeline: buildImpactTimeline(aggregationArticles),
      momentumSignals: buildMomentumSignals(aggregationArticles),
      signalRadar: buildSignalRadar(aggregationArticles),
      valueChainMap: buildValueChainMap(aggregationArticles)
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
          "Articles are processed through the configured AI provider in concurrent batches; malformed large responses are split and retried before Zod validation."
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
      },
      {
        step: "Relevance and momentum",
        detail:
          "Top Events must pass the AI relevance gate where possible; trend radar uses recent-vs-baseline momentum instead of raw keyword frequency."
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
    "Write executiveBrief, rationale, impact, watchNext, risks, and opportunities in English only.",
    "Generate the entire report support payload: executiveBrief, topEvents, deepDives, trendRadar, riskOpportunity, and charts.",
    "The charts object must contain topicDistribution, sourceMix, impactTimeline, momentumSignals, signalRadar, and valueChainMap arrays. Chart rows may contain string and number fields only.",
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

  const baseURL = options.baseUrl ?? DEFAULT_OPENAI_BASE_URL;
  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL,
    name: baseURL.includes("deepseek") ? "deepseek" : "openai"
  });

  if (baseURL.includes("deepseek")) {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a strict daily AI intelligence report synthesis system. Return only valid JSON that follows the requested shape. Do not include markdown."
          },
          { role: "user", content: buildReportSynthesisPrompt(baseline) }
        ],
        temperature: 0.2,
        max_tokens: 8192,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(90_000)
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI-compatible report synthesis failed: ${response.status} ${text.slice(0, 500)}`);
    }
    const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI-compatible report synthesis returned an empty message.");
    }

    return AiReportSupportSchema.parse(JSON.parse(content));
  }

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
      charts: {
        ...aiSupport.charts,
        momentumSignals: baseline.charts.momentumSignals
      },
      schemaRationale: [
        ...baseline.schemaRationale,
        "Daily report support data is synthesized by the configured AI provider from validated article-level insights, then revalidated before rendering."
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
                "The configured AI provider synthesizes final dashboard and PDF support data from validated schema fields; code then revalidates and renders it."
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
