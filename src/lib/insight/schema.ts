import { z } from "zod";

const IsoDateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected an ISO-compatible datetime string"
});

export const SourceTypeSchema = z.enum([
  "tech_media",
  "official",
  "research",
  "developer",
  "aggregator",
  "social"
]);

export const InsightSourceTypeSchema = z.enum([
  "official",
  "media",
  "community",
  "research",
  "social"
]);

export const LanguageSchema = z.enum(["zh", "en", "mixed"]);
export const InsightLanguageSchema = z.enum(["zh", "en", "other"]);

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

export const InsightCategorySchema = z.enum([
  "model_release",
  "ai_product",
  "infrastructure",
  "research",
  "policy",
  "capital",
  "security",
  "industry_application"
]);

export const EntityTypeSchema = z.enum([
  "company",
  "model",
  "product",
  "person",
  "organization",
  "technology"
]);

export const EventTypeSchema = z.enum([
  "launch",
  "upgrade",
  "partnership",
  "funding",
  "regulation",
  "research_result",
  "controversy",
  "market_signal"
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
  publishedAt: IsoDateTimeSchema,
  collectedAt: IsoDateTimeSchema,
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
  sourceTypeNormalized: InsightSourceTypeSchema,
  url: z.string().url(),
  publishedAt: IsoDateTimeSchema,
  language: LanguageSchema,
  languageNormalized: InsightLanguageSchema,
  category: InsightCategorySchema,
  eventType: EventTypeSchema,
  summary: z.string().min(12),
  keyFacts: z.array(z.string()).min(1),
  impactAnalysis: z.string().min(12),
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
    geographies: z.array(z.string()),
    extracted: z.array(
      z.object({
        name: z.string().min(1),
        type: EntityTypeSchema
      })
    )
  }),
  signals: z.object({
    novelty: z.number().int().min(0).max(5),
    adoption: z.number().int().min(0).max(5),
    technicalDepth: z.number().int().min(0).max(5),
    regulatoryWeight: z.number().int().min(0).max(5),
    capitalIntensity: z.number().int().min(0).max(5)
  }),
  sentiment: SentimentSchema,
  importanceScore: z.number().int().min(1).max(5),
  confidenceScore: z.number().min(0).max(1),
  riskSignals: z.array(z.string()),
  opportunitySignals: z.array(z.string()),
  evidence: z.array(
    z.object({
      field: z.string(),
      quoteOrReason: z.string()
    })
  ),
  keywords: z.array(z.string()).min(2).max(10),
  extractionMeta: z.object({
    method: z.enum(["ai", "deterministic_fallback"]),
    promptVersion: z.string(),
    validatedAt: IsoDateTimeSchema,
    warnings: z.array(z.string())
  })
});

export const NewsInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  source_type: InsightSourceTypeSchema,
  url: z.string().url().optional(),
  published_at: IsoDateTimeSchema,
  language: InsightLanguageSchema,
  category: InsightCategorySchema,
  entities: z.array(
    z.object({
      name: z.string(),
      type: EntityTypeSchema
    })
  ),
  event_type: EventTypeSchema,
  summary: z.string(),
  key_facts: z.array(z.string()),
  impact_analysis: z.string(),
  sentiment: SentimentSchema,
  importance_score: z.number().min(1).max(5),
  confidence_score: z.number().min(0).max(1),
  risk_signals: z.array(z.string()),
  opportunity_signals: z.array(z.string()),
  evidence: z.array(
    z.object({
      field: z.string(),
      quote_or_reason: z.string()
    })
  )
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
  generatedAt: IsoDateTimeSchema,
  coverageWindow: z.object({
    start: IsoDateTimeSchema,
    end: IsoDateTimeSchema
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
export type InsightSourceType = z.infer<typeof InsightSourceTypeSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type InsightLanguage = z.infer<typeof InsightLanguageSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type ValueChain = z.infer<typeof ValueChainSchema>;
export type InsightCategory = z.infer<typeof InsightCategorySchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
export type RawNewsItem = z.infer<typeof RawNewsItemSchema>;
export type SourceManifest = z.infer<typeof SourceManifestSchema>;
export type ArticleInsight = z.infer<typeof ArticleInsightSchema>;
export type NewsInsight = z.infer<typeof NewsInsightSchema>;
export type DailyReport = z.infer<typeof DailyReportSchema>;
export type QualityGate = z.infer<typeof QualityGateSchema>;
