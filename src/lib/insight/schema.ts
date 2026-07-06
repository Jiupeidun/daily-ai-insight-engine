import { z } from "zod";

export const SourceTypeSchema = z.enum([
  "tech_media",
  "official",
  "research",
  "developer",
  "aggregator",
  "social"
]);

export const LanguageSchema = z.enum(["zh", "en", "mixed"]);

export const TopicSchema = z.enum([
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
]);

export const ValueChainSchema = z.enum([
  "model",
  "data",
  "compute",
  "application",
  "tooling",
  "governance",
  "market"
]);

export const HorizonSchema = z.enum(["today", "weeks", "quarter", "long_term"]);

export const SentimentSchema = z.enum([
  "positive",
  "neutral",
  "negative",
  "mixed"
]);

export const RawNewsItemSchema = z.object({
  id: z.string().min(8),
  title: z.string().min(6),
  summary: z.string().min(16),
  content: z.string().default(""),
  url: z.string().url(),
  sourceName: z.string().min(2),
  sourceUrl: z.string().url(),
  sourceType: SourceTypeSchema,
  publishedAt: z.string().datetime(),
  collectedAt: z.string().datetime(),
  language: LanguageSchema,
  authors: z.array(z.string()).default([]),
  rawTags: z.array(z.string()).default([])
});

export const SourceManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  type: SourceTypeSchema,
  rationale: z.string(),
  languageHint: LanguageSchema.optional()
});

export const ArticleInsightSchema = z.object({
  id: z.string().min(8),
  rawId: z.string().min(8),
  title: z.string().min(6),
  sourceName: z.string().min(2),
  sourceType: SourceTypeSchema,
  url: z.string().url(),
  publishedAt: z.string().datetime(),
  language: LanguageSchema,
  canonicalEvent: z.object({
    whatHappened: z.string().min(12),
    whyItMatters: z.string().min(12),
    affectedActors: z.array(z.string()).min(1),
    evidence: z.string().min(12),
    confidence: z.number().min(0).max(1)
  }),
  taxonomy: z.object({
    topics: z.array(TopicSchema).min(1),
    valueChain: z.array(ValueChainSchema).min(1),
    maturity: z.enum(["signal", "emerging", "mainstream", "uncertain"])
  }),
  impact: z.object({
    score: z.number().int().min(0).max(100),
    horizon: HorizonSchema,
    stakeholders: z.array(z.string()).min(1),
    risks: z.array(z.string()),
    opportunities: z.array(z.string())
  }),
  entities: z.object({
    organizations: z.array(z.string()),
    products: z.array(z.string()),
    people: z.array(z.string()),
    geographies: z.array(z.string())
  }),
  signals: z.object({
    novelty: z.number().int().min(0).max(5),
    adoption: z.number().int().min(0).max(5),
    technicalDepth: z.number().int().min(0).max(5),
    regulatoryWeight: z.number().int().min(0).max(5),
    capitalIntensity: z.number().int().min(0).max(5)
  }),
  sentiment: SentimentSchema,
  keywords: z.array(z.string()).min(2).max(10),
  extractionMeta: z.object({
    method: z.enum(["ai", "deterministic_fallback"]),
    promptVersion: z.string(),
    validatedAt: z.string().datetime(),
    warnings: z.array(z.string())
  })
});

export const QualityGateSchema = z.object({
  name: z.string(),
  status: z.enum(["pass", "warn", "fail"]),
  value: z.string(),
  rationale: z.string()
});

export const ChartDatumSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export const DailyReportSchema = z.object({
  id: z.string(),
  title: z.string(),
  generatedAt: z.string().datetime(),
  coverageWindow: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  sourceStats: z.object({
    rawCount: z.number().int().nonnegative(),
    structuredCount: z.number().int().nonnegative(),
    sourceCount: z.number().int().nonnegative(),
    languageMix: z.record(LanguageSchema, z.number().int().nonnegative()),
    sourceTypeMix: z.record(SourceTypeSchema, z.number().int().nonnegative())
  }),
  schemaRationale: z.array(z.string()).min(3),
  qualityGates: z.array(QualityGateSchema),
  executiveBrief: z.string().min(40),
  topEvents: z.array(
    z.object({
      rank: z.number().int().positive(),
      articleId: z.string(),
      title: z.string(),
      score: z.number().int().min(0).max(100),
      whyImportant: z.string(),
      evidence: z.string(),
      url: z.string().url()
    })
  ),
  deepDives: z.array(
    z.object({
      articleId: z.string(),
      headline: z.string(),
      background: z.string(),
      impact: z.string(),
      watchNext: z.string(),
      citedUrls: z.array(z.string().url())
    })
  ),
  trendRadar: z.array(
    z.object({
      theme: TopicSchema,
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
    topicDistribution: z.array(ChartDatumSchema),
    sourceMix: z.array(ChartDatumSchema),
    impactTimeline: z.array(ChartDatumSchema),
    signalRadar: z.array(ChartDatumSchema),
    valueChainMap: z.array(ChartDatumSchema)
  }),
  articles: z.array(ArticleInsightSchema),
  methodology: z.array(
    z.object({
      step: z.string(),
      detail: z.string()
    })
  )
});

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type ValueChain = z.infer<typeof ValueChainSchema>;
export type RawNewsItem = z.infer<typeof RawNewsItemSchema>;
export type SourceManifest = z.infer<typeof SourceManifestSchema>;
export type ArticleInsight = z.infer<typeof ArticleInsightSchema>;
export type DailyReport = z.infer<typeof DailyReportSchema>;
export type QualityGate = z.infer<typeof QualityGateSchema>;
