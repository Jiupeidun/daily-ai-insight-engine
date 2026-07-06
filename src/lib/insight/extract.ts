import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type {
  ArticleInsight,
  AiRelevanceTier,
  EventType,
  InsightCategory,
  NewsInsight,
  RawNewsItem,
  SourceType,
  Topic,
  ValueChain
} from "./schema";
import { ARTICLE_SCHEMA_VERSION, ArticleInsightSchema, NewsInsightSchema, SCORING_VERSION } from "./schema";
import { stableId, truncateText } from "./normalize";

export const PROMPT_VERSION = "extract-news-v1";
export const DEFAULT_OPENAI_BASE_URL = "https://api.deepseek.com/v1";
export const DEFAULT_OPENAI_MODEL = "deepseek-chat";

type AiProvider = "deterministic" | "openai_compatible" | "cloudflare_rest";

type ExtractionOptions = {
  provider?: AiProvider;
  batchSize?: number;
  concurrency?: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareModel?: string;
  onFailure?: (failure: ExtractionFailure) => void;
};

export type ExtractionFailure = {
  rawId: string;
  title: string;
  sourceName: string;
  stage: "extract" | "repair" | "validation";
  error: string;
};

const TOPIC_RULES: Array<{ topic: Topic; keywords: string[] }> = [
  {
    topic: "frontier_model",
    keywords: ["gpt", "claude", "gemini", "llama", "frontier", "model", "reasoning"]
  },
  {
    topic: "ai_infrastructure",
    keywords: ["gpu", "inference", "datacenter", "compute", "chip", "nvidia", "accelerator"]
  },
  {
    topic: "product_launch",
    keywords: ["launch", "release", "roll out", "introduce", "app", "feature", "product"]
  },
  {
    topic: "research",
    keywords: ["research", "paper", "benchmark", "arxiv", "study", "scientists"]
  },
  {
    topic: "open_source",
    keywords: ["open source", "hugging face", "github", "apache", "mit license"]
  },
  {
    topic: "policy_regulation",
    keywords: ["policy", "regulation", "law", "government", "eu ai act", "copyright", "lawsuit"]
  },
  {
    topic: "capital_market",
    keywords: ["funding", "acquisition", "valuation", "ipo", "revenue", "investment"]
  },
  {
    topic: "safety_security",
    keywords: ["safety", "security", "risk", "misuse", "alignment", "privacy", "jailbreak"]
  },
  {
    topic: "enterprise_adoption",
    keywords: ["enterprise", "customer", "business", "workflow", "salesforce", "microsoft"]
  },
  {
    topic: "developer_tools",
    keywords: ["api", "sdk", "developer", "tool", "agent", "coding", "copilot"]
  }
];

const VALUE_CHAIN_RULES: Array<{ value: ValueChain; keywords: string[] }> = [
  { value: "model", keywords: ["model", "gpt", "claude", "gemini", "llama"] },
  { value: "data", keywords: ["data", "dataset", "training", "synthetic"] },
  { value: "compute", keywords: ["gpu", "chip", "compute", "inference", "datacenter"] },
  { value: "application", keywords: ["app", "assistant", "workflow", "customer", "enterprise"] },
  { value: "tooling", keywords: ["api", "sdk", "developer", "agent", "tool"] },
  { value: "governance", keywords: ["policy", "safety", "regulation", "copyright"] },
  { value: "market", keywords: ["funding", "revenue", "valuation", "acquisition", "startup"] }
];

const CORE_AI_PATTERNS = [
  /\b(ai|artificial intelligence|generative ai|llm|llms|large language model)\b/i,
  /\b(gpt|claude|gemini|llama|mistral|chatgpt|copilot|grok)\b/i,
  /\b(model release|foundation model|frontier model|reasoning model)\b/i,
  /\b(agent|agents|inference|training|fine-tuning|benchmark|evals?)\b/i,
  /人工智能|大模型|生成式|智能体|模型|推理|训练|多模态|算力/
];

const AI_COMPUTE_PATTERNS = [
  /\b(gpu|accelerator|hbm|cuda|inference chip|ai chip|datacenter|data center)\b/i,
  /\b(nvidia|tsmc|broadcom|amd|micron|asml|super micro|marvell|arm holdings|oracle|dell|western digital|seagate)\b/i,
  /\b(nvda|tsm|avgo|mu|asml|smci|mrvl|arm|orcl|msft|googl|amzn|dell|wdc|stx)\b/i,
  /\b(storage stocks?|semiconductor stocks?|chip stocks?|ai stocks?|data center stocks?)\b/i,
  /英伟达|台积电|博通|美光|数据中心|芯片|半导体|算力/
];

const LOW_VALUE_ADJACENT_PATTERNS = [
  /\b(gaming|game|laptop deal|discount|coupon|oled gaming|desktop graphics card)\b/i,
  /\b(review|benchmark).*\b(game|gaming|fps)\b/i,
  /\bcommercial|advertisement|ad campaign\b/i,
  /游戏|显卡评测|促销|折扣|广告/
];

const AI_WORKLOAD_CONTEXT_PATTERNS = [
  /\b(ai workload|model training|inference|datacenter|data center|cloud capex|ai server)\b/i,
  /\b(enterprise ai|developer tool|api|sdk|agent|copilot)\b/i,
  /模型训练|推理|数据中心|AI 服务器|企业 AI|智能体/
];

const KNOWN_ORGS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "DeepMind",
  "Microsoft",
  "Meta",
  "Nvidia",
  "Apple",
  "Amazon",
  "Hugging Face",
  "Mistral",
  "xAI",
  "Perplexity",
  "Salesforce",
  "GitHub",
  "TechCrunch",
  "MIT",
  "VentureBeat"
];

function includesAny(text: string, keywords: string[]): boolean {
  const haystack = text.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function patternHits(text: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function relevanceTier(score: number): AiRelevanceTier {
  if (score >= 70) return "core";
  if (score >= 45) return "adjacent";
  return "noise";
}

function calculateAiRelevance(input: {
  text: string;
  sourceType: SourceType;
  topics: Topic[];
  organizations: string[];
}) {
  const coreHits = patternHits(input.text, CORE_AI_PATTERNS);
  const computeHits = patternHits(input.text, AI_COMPUTE_PATTERNS);
  const lowValueHits = patternHits(input.text, LOW_VALUE_ADJACENT_PATTERNS);
  const workloadContextHits = patternHits(input.text, AI_WORKLOAD_CONTEXT_PATTERNS);
  const topicScore = input.topics.reduce((score, topic) => {
    if (topic === "frontier_model") return score + 28;
    if (topic === "developer_tools" || topic === "research") return score + 18;
    if (topic === "enterprise_adoption" || topic === "policy_regulation") return score + 14;
    if (topic === "ai_infrastructure") return score + 10;
    if (topic === "capital_market" || topic === "safety_security") return score + 8;
    return score + 4;
  }, 0);
  const sourceScore =
    input.sourceType === "official"
      ? 10
      : input.sourceType === "financial"
        ? 8
      : input.sourceType === "research"
        ? 8
        : input.sourceType === "developer"
          ? 6
          : input.sourceType === "tech_media"
            ? 4
            : 2;
  const knownAiOrgScore = input.organizations.some((org) =>
    ["openai", "anthropic", "google", "deepmind", "microsoft", "meta", "nvidia", "hugging face", "mistral", "xai"].includes(
      org.toLowerCase()
    )
  )
    ? 12
    : 0;
  const lowValuePenalty = lowValueHits > 0 && workloadContextHits === 0 ? 34 : lowValueHits * 10;
  const score = clampScore(
    coreHits * 24 +
      computeHits * (workloadContextHits > 0 ? 12 : 5) +
      workloadContextHits * 14 +
      Math.min(30, topicScore) +
      sourceScore +
      knownAiOrgScore -
      lowValuePenalty
  );
  const tier = relevanceTier(score);
  const rationale =
    tier === "core"
      ? "Core AI signal: direct model, agent, AI product, research, infrastructure, or governance evidence is present."
      : tier === "adjacent"
        ? "Adjacent AI signal: related market, compute, developer, or ecosystem context is present but direct AI evidence is limited."
        : "Noise: low direct AI evidence or likely consumer hardware, gaming, deal, or commentary item.";

  return { score, tier, rationale };
}

function inferTopics(text: string): Topic[] {
  const topics = TOPIC_RULES.filter((rule) => includesAny(text, rule.keywords)).map(
    (rule) => rule.topic
  );
  return topics.length > 0 ? Array.from(new Set(topics)) : ["product_launch"];
}

function inferValueChain(text: string): ValueChain[] {
  const values = VALUE_CHAIN_RULES.filter((rule) => includesAny(text, rule.keywords)).map(
    (rule) => rule.value
  );
  return values.length > 0 ? Array.from(new Set(values)) : ["application"];
}

function inferOrganizations(text: string): string[] {
  const found = KNOWN_ORGS.filter((org) =>
    text.toLowerCase().includes(org.toLowerCase())
  );
  return found.length > 0 ? Array.from(new Set(found)) : ["AI ecosystem"];
}

function inferKeywords(text: string, topics: Topic[]): string[] {
  const candidates = [
    ...topics.map((topic) => topic.replace(/_/g, " ")),
    ...KNOWN_ORGS.filter((org) => text.toLowerCase().includes(org.toLowerCase())).map(
      (org) => org.toLowerCase()
    ),
    ...Array.from(text.matchAll(/\b[A-Z][a-zA-Z0-9-]{3,}\b/g)).map((match) =>
      match[0].toLowerCase()
    )
  ];

  const keywords = Array.from(new Set(candidates))
    .filter((keyword) => keyword.length > 2)
    .slice(0, 8);

  if (keywords.length >= 2) {
    return keywords;
  }

  return Array.from(new Set([...keywords, "ai signal", topics[0].replace(/_/g, " ")])).slice(
    0,
    2
  );
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sourceImpactWeight(sourceType: SourceType): number {
  if (sourceType === "official") return 8;
  if (sourceType === "financial") return 7;
  if (sourceType === "research") return 6;
  if (sourceType === "tech_media") return 5;
  if (sourceType === "developer") return 4;
  if (sourceType === "aggregator") return 2;
  return 1;
}

function recencyImpactWeight(publishedAt: string): number {
  const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 36e5);
  if (ageHours <= 12) return 10;
  if (ageHours <= 24) return 8;
  if (ageHours <= 72) return 6;
  if (ageHours <= 168) return 4;
  return 1;
}

function entityImpactWeight(organizations: string[]): number {
  const majorEntities = [
    "openai",
    "google",
    "nvidia",
    "anthropic",
    "meta",
    "microsoft",
    "apple",
    "amazon",
    "tsmc",
    "broadcom",
    "micron",
    "amd",
    "asml",
    "super micro",
    "marvell",
    "oracle",
    "dell",
    "western digital",
    "seagate"
  ];
  return organizations.some((org) => majorEntities.includes(org.toLowerCase())) ? 8 : Math.min(5, organizations.length * 2);
}

function eventImpactWeight(eventType: EventType): number {
  if (eventType === "regulation" || eventType === "funding") return 9;
  if (eventType === "launch" || eventType === "research_result") return 8;
  if (eventType === "partnership" || eventType === "controversy") return 7;
  if (eventType === "upgrade") return 6;
  return 4;
}

function calculateAiImpactScore(input: {
  importanceScore: number;
  confidenceScore: number;
  sourceType: SourceType;
  eventType: EventType;
  organizations: string[];
  publishedAt: string;
  riskSignals: string[];
  opportunitySignals: string[];
}) {
  const score =
    24 +
    input.importanceScore * 7 +
    sourceImpactWeight(input.sourceType) +
    eventImpactWeight(input.eventType) +
    entityImpactWeight(input.organizations) +
    recencyImpactWeight(input.publishedAt) +
    input.confidenceScore * 8 +
    Math.min(6, input.riskSignals.length + input.opportunitySignals.length);

  return Math.min(97, clampScore(score));
}

function normalizeSourceType(sourceType: SourceType) {
  if (sourceType === "official") return "official";
  if (sourceType === "research") return "research";
  if (sourceType === "social") return "social";
  if (sourceType === "financial") return "media";
  if (sourceType === "aggregator" || sourceType === "developer") return "community";
  return "media";
}

function normalizeLanguage(language: RawNewsItem["language"]) {
  return language === "zh" || language === "en" ? language : "other";
}

function inferCategory(topics: Topic[]): InsightCategory {
  if (topics.includes("frontier_model")) return "model_release";
  if (topics.includes("ai_infrastructure")) return "infrastructure";
  if (topics.includes("research")) return "research";
  if (topics.includes("policy_regulation")) return "policy";
  if (topics.includes("capital_market")) return "capital";
  if (topics.includes("safety_security")) return "security";
  if (topics.includes("enterprise_adoption")) return "industry_application";
  return "ai_product";
}

function inferEventType(text: string, topics: Topic[]): EventType {
  if (includesAny(text, ["funding", "raised", "investment", "valuation"])) return "funding";
  if (includesAny(text, ["regulation", "policy", "law", "act"])) return "regulation";
  if (includesAny(text, ["partner", "partnership", "alliance"])) return "partnership";
  if (includesAny(text, ["controversy", "lawsuit", "risk", "security", "privacy"])) return "controversy";
  if (topics.includes("research")) return "research_result";
  if (includesAny(text, ["upgrade", "improve", "new version"])) return "upgrade";
  if (includesAny(text, ["launch", "release", "introduce", "roll out"])) return "launch";
  return "market_signal";
}

function inferExtractedEntities(text: string) {
  const organizations = inferOrganizations(text).map((name) => ({
    name,
    type: "company" as const
  }));
  const products = inferProducts(text).map((name) => ({
    name,
    type: "product" as const
  }));
  return [...organizations, ...products].slice(0, 8);
}

function buildKeyFacts(item: RawNewsItem, firstSentence: string, topics: Topic[]) {
  return [
    firstSentence,
    `Source type is ${normalizeSourceType(item.sourceType)}, which affects trust weighting.`,
    `Primary extracted categories: ${topics.slice(0, 3).join(", ")}.`
  ];
}

function calculateImportanceScore(input: {
  sourceType: SourceType;
  organizations: string[];
  category: InsightCategory;
  eventType: EventType;
  sentiment: ArticleInsight["sentiment"];
  isRecent: boolean;
}) {
  const sourceWeight =
    input.sourceType === "official" ? 1 : input.sourceType === "financial" || input.sourceType === "tech_media" ? 0.5 : 0;
  const entityWeight = input.organizations.some((org) =>
    ["openai", "google", "nvidia", "anthropic", "meta"].includes(org.toLowerCase())
  )
    ? 1
    : 0;
  const categoryWeight = ["model_release", "policy", "capital"].includes(input.category) ? 1 : 0;
  const sentimentWeight = input.sentiment === "negative" || input.sentiment === "mixed" ? 0.5 : 0;
  const recencyWeight = input.isRecent ? 0.5 : 0;
  return Math.max(1, Math.min(5, Math.round(1 + sourceWeight + entityWeight + categoryWeight + sentimentWeight + recencyWeight)));
}

export function extractDeterministic(item: RawNewsItem): ArticleInsight {
  const text = `${item.title}. ${item.summary}. ${item.content}`;
  const topics = inferTopics(text);
  const valueChain = inferValueChain(text);
  const organizations = inferOrganizations(text);
  const aiRelevance = calculateAiRelevance({ text, sourceType: item.sourceType, topics, organizations });
  const isOfficial = item.sourceType === "official";
  const isResearch = item.sourceType === "research";
  const isRecent = Date.now() - new Date(item.publishedAt).getTime() < 1000 * 60 * 60 * 24 * 10;
  const novelty = includesAny(text, ["launch", "new", "first", "release", "breakthrough"]) ? 4 : 3;
  const adoption = includesAny(text, ["enterprise", "customer", "user", "workflow", "deploy"]) ? 4 : 2;
  const technicalDepth = isResearch || includesAny(text, ["benchmark", "model", "training", "inference"])
    ? 4
    : 2;
  const regulatoryWeight = includesAny(text, ["regulation", "policy", "law", "safety", "copyright"])
    ? 4
    : 1;
  const capitalIntensity = includesAny(text, ["funding", "valuation", "investment", "gpu", "datacenter"])
    ? 4
    : 1;
  const uncappedScore = Math.min(
    96,
    clampScore(
      30 +
        novelty * 5 +
        adoption * 4 +
        technicalDepth * 4 +
        regulatoryWeight * 3 +
        capitalIntensity * 3 +
        sourceImpactWeight(item.sourceType) +
        entityImpactWeight(organizations) +
        recencyImpactWeight(item.publishedAt)
    )
  );
  const score =
    aiRelevance.tier === "core"
      ? uncappedScore
      : aiRelevance.tier === "adjacent"
        ? Math.min(68, uncappedScore)
        : Math.min(38, uncappedScore);
  const horizon = regulatoryWeight >= 4 ? "quarter" : adoption >= 4 ? "weeks" : "today";
  const summaryCandidate = item.summary.split(/[.!?。！？]/)[0] ?? item.summary;
  const firstSentence = truncateText(
    summaryCandidate.trim().length >= 12 ? summaryCandidate : `${item.title}: ${item.summary}`,
    220
  );
  const sentiment = topics.includes("safety_security") || topics.includes("policy_regulation")
    ? "mixed"
    : "neutral";
  const category = inferCategory(topics);
  const eventType = inferEventType(text, topics);
  const risks = buildRisks(topics);
  const opportunities = buildOpportunities(topics);
  const confidence = isOfficial ? 0.86 : isResearch ? 0.78 : 0.7;

  return ArticleInsightSchema.parse({
    schemaVersion: ARTICLE_SCHEMA_VERSION,
    scoringVersion: SCORING_VERSION,
    id: stableId(`insight:${item.id}`),
    rawId: item.id,
    title: item.title,
    sourceName: item.sourceName,
    sourceType: item.sourceType,
    sourceTypeNormalized: normalizeSourceType(item.sourceType),
    url: item.url,
    publishedAt: item.publishedAt,
    language: item.language,
    languageNormalized: normalizeLanguage(item.language),
    category,
    eventType,
    summary: firstSentence,
    keyFacts: buildKeyFacts(item, firstSentence, topics),
    impactAnalysis:
      score >= 75
        ? "This event is important because source credibility, entity relevance, category weight, and recency combine into a strong signal."
        : "This event is useful as a supporting signal but should be interpreted with follow-up evidence.",
    canonicalEvent: {
      whatHappened: firstSentence,
      whyItMatters:
        score >= 75
          ? "This item has strong near-term impact because it combines credible source signal with product, market, or technical change."
          : "This item contributes to the daily signal set and helps triangulate where AI attention is moving.",
      affectedActors: organizations,
      evidence: truncateText(item.summary, 260),
      confidence
    },
    taxonomy: {
      topics,
      valueChain,
      maturity: isResearch ? "emerging" : score >= 76 ? "mainstream" : "signal"
    },
    impact: {
      score,
      horizon,
      stakeholders: Array.from(
        new Set([
          ...organizations,
          topics.includes("developer_tools") ? "developers" : "AI product teams",
          topics.includes("policy_regulation") ? "policy teams" : "enterprise buyers"
        ])
      ),
      risks,
      opportunities
    },
    entities: {
      organizations,
      products: inferProducts(text),
      people: [],
      geographies: inferGeographies(text),
      extracted: inferExtractedEntities(text)
    },
    signals: {
      novelty,
      adoption,
      technicalDepth,
      regulatoryWeight,
      capitalIntensity
    },
    sentiment,
    importanceScore: calculateImportanceScore({
      sourceType: item.sourceType,
      organizations,
      category,
      eventType,
      sentiment,
      isRecent
    }),
    confidenceScore: confidence,
    aiRelevance,
    riskSignals: risks,
    opportunitySignals: opportunities,
    evidence: [
      { field: "summary", quoteOrReason: truncateText(item.summary, 180) },
      { field: "source_type", quoteOrReason: `${item.sourceName} normalized to ${normalizeSourceType(item.sourceType)}` },
      { field: "importance_score", quoteOrReason: "Rule-based score combines source, entity, category, sentiment, and recency weights." }
    ],
    keywords: inferKeywords(text, topics),
    extractionMeta: {
      method: "deterministic_fallback",
      promptVersion: PROMPT_VERSION,
      schemaVersion: ARTICLE_SCHEMA_VERSION,
      scoringVersion: SCORING_VERSION,
      validatedAt: new Date().toISOString(),
      warnings: [
        "Generated by deterministic extractor because no validated AI response was used.",
        ...(aiRelevance.tier === "noise" ? ["AI relevance gate classified this item as noise."] : [])
      ]
    }
  });
}

function buildRisks(topics: Topic[]): string[] {
  const risks = new Set<string>();
  if (topics.includes("policy_regulation")) {
    risks.add("Regulatory interpretation may change product rollout timing.");
  }
  if (topics.includes("safety_security")) {
    risks.add("Safety or privacy concerns could slow adoption or trigger scrutiny.");
  }
  if (topics.includes("ai_infrastructure")) {
    risks.add("Compute supply, cost, or latency may constrain scale.");
  }
  if (topics.includes("open_source")) {
    risks.add("Open release may create governance and misuse tradeoffs.");
  }
  if (risks.size === 0) {
    risks.add("Signal may be overstated until follow-up adoption data appears.");
  }
  return Array.from(risks);
}

function buildOpportunities(topics: Topic[]): string[] {
  const opportunities = new Set<string>();
  if (topics.includes("developer_tools")) {
    opportunities.add("Developer workflow automation can compound quickly through integrations.");
  }
  if (topics.includes("enterprise_adoption")) {
    opportunities.add("Enterprise buyers may convert experimentation into budgeted workflows.");
  }
  if (topics.includes("research")) {
    opportunities.add("Research signal can become product differentiation if validated in benchmarks.");
  }
  if (topics.includes("ai_infrastructure")) {
    opportunities.add("Infrastructure improvements can lower inference cost and unlock new usage.");
  }
  if (opportunities.size === 0) {
    opportunities.add("Track follow-up releases and usage data for investable momentum.");
  }
  return Array.from(opportunities);
}

function inferProducts(text: string): string[] {
  const products = ["ChatGPT", "Claude", "Gemini", "Copilot", "Llama", "Grok"].filter(
    (product) => text.toLowerCase().includes(product.toLowerCase())
  );
  return Array.from(new Set(products));
}

function inferGeographies(text: string): string[] {
  const geographies = ["US", "EU", "China", "UK", "Japan", "India"].filter((geo) =>
    text.toLowerCase().includes(geo.toLowerCase())
  );
  return geographies;
}

export function buildExtractionPrompt(batch: RawNewsItem[]): string {
  return [
    "You are extracting structured AI industry signals for a daily intelligence report.",
    "Return only valid JSON. Do not summarize the batch as prose.",
    "For each article, extract a deep NewsInsight schema, not a shallow title/summary/source object.",
    "Required insight fields include: source_type, category, entities, event_type, summary, key_facts, impact_analysis, sentiment, importance_score, confidence_score, risk_signals, opportunity_signals, and evidence.",
    `Use schema_version=${ARTICLE_SCHEMA_VERSION}; the backend will attach schemaVersion, scoringVersion, and aiRelevance after validation.`,
    "importance_score is 1-5. confidence_score is 0-1. evidence must explain which source text or rule supports important fields.",
    "Use the article summary as evidence. Do not invent facts that are not supported by the item.",
    "Expected output shape is an array of NewsInsight-like objects. The SDK will add source identity fields from the original item.",
    "Allowed source_type: official, media, community, research, social.",
    "Allowed category: model_release, ai_product, infrastructure, research, policy, capital, security, industry_application.",
    "Allowed event_type: launch, upgrade, partnership, funding, regulation, research_result, controversy, market_signal.",
    "Allowed entity type: company, model, product, person, organization, technology.",
    JSON.stringify({ batch }, null, 2)
  ].join("\n\n");
}

function buildRepairPrompt(batch: RawNewsItem[], invalidJson: string, error: string): string {
  return [
    "Repair the following JSON so it exactly matches the requested ArticleInsight[] schema.",
    "Return only valid JSON with shape {\"articles\": ArticleInsight[]}.",
    "Do not add facts outside the provided source batch.",
    `Validation error: ${error}`,
    "Source batch:",
    JSON.stringify({ batch }, null, 2),
    "Invalid JSON:",
    invalidJson
  ].join("\n\n");
}

function parseJsonObject(input: string): unknown {
  const trimmed = input.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
  }

  throw new Error("AI response did not contain a JSON object.");
}

function normalizeInsightLanguage(value: unknown, fallback: RawNewsItem["language"]) {
  if (value === "zh" || value === "en" || value === "other") {
    return value;
  }
  return fallback === "zh" || fallback === "en" ? fallback : "other";
}

function normalizeInsightSourceType(value: unknown, fallback: SourceType) {
  if (value === "official" || value === "media" || value === "community" || value === "research" || value === "social") {
    return value;
  }
  return normalizeSourceType(fallback);
}

function normalizeInsightEvidence(value: unknown, fallback: RawNewsItem) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object") {
        const object = item as { field?: unknown; quote_or_reason?: unknown; quoteOrReason?: unknown };
        return {
          field: typeof object.field === "string" ? object.field : "summary",
          quote_or_reason:
            typeof object.quote_or_reason === "string"
              ? object.quote_or_reason
              : typeof object.quoteOrReason === "string"
                ? object.quoteOrReason
                : truncateText(fallback.summary, 180)
        };
      }
      return { field: "summary", quote_or_reason: String(item) };
    });
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [{ field: "summary", quote_or_reason: value }];
  }

  return [{ field: "summary", quote_or_reason: truncateText(fallback.summary, 180) }];
}

function normalizeInsightCategory(value: unknown, text: string) {
  const allowed = [
    "model_release",
    "ai_product",
    "infrastructure",
    "research",
    "policy",
    "capital",
    "security",
    "industry_application"
  ];
  if (typeof value === "string" && allowed.includes(value)) {
    return value;
  }
  return inferCategory(inferTopics(text));
}

function normalizeInsightEventType(value: unknown, text: string) {
  const allowed = [
    "launch",
    "upgrade",
    "partnership",
    "funding",
    "regulation",
    "research_result",
    "controversy",
    "market_signal"
  ];
  if (typeof value === "string" && allowed.includes(value)) {
    return value;
  }
  const topics = inferTopics(text);
  return inferEventType(text, topics);
}

function normalizeInsightSentiment(value: unknown) {
  return value === "positive" || value === "neutral" || value === "negative" || value === "mixed"
    ? value
    : "neutral";
}

function normalizeBoundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function normalizeEntityType(value: unknown) {
  if (
    value === "company" ||
    value === "model" ||
    value === "product" ||
    value === "person" ||
    value === "organization" ||
    value === "technology"
  ) {
    return value;
  }

  const normalized = String(value ?? "").toLowerCase();
  if (["stock", "ticker", "equity", "vendor", "startup", "company_ticker"].includes(normalized)) {
    return "company";
  }
  if (["institute", "agency", "university", "lab"].includes(normalized)) {
    return "organization";
  }
  if (["software", "platform", "service", "tool"].includes(normalized)) {
    return "product";
  }
  if (["method", "framework", "chip", "hardware"].includes(normalized)) {
    return "technology";
  }

  return "organization";
}

function normalizeEntities(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const object = item as { name?: unknown; type?: unknown };
    if (typeof object.name !== "string" || object.name.trim().length === 0) {
      return [];
    }
    return [{ name: object.name, type: normalizeEntityType(object.type) }];
  });
}

function coerceNewsInsightItems(rawItems: unknown[], batch: RawNewsItem[]) {
  return rawItems.map((item, index) => {
    const object = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const text = `${batch[index].title}. ${batch[index].summary}. ${batch[index].content}`;
    return {
      ...object,
      source_type: normalizeInsightSourceType(object.source_type, batch[index].sourceType),
      language: normalizeInsightLanguage(object.language, batch[index].language),
      category: normalizeInsightCategory(object.category, text),
      event_type: normalizeInsightEventType(object.event_type, text),
      entities: normalizeEntities(object.entities),
      sentiment: normalizeInsightSentiment(object.sentiment),
      importance_score: normalizeBoundedNumber(object.importance_score, 3, 1, 5),
      confidence_score: normalizeBoundedNumber(object.confidence_score, 0.72, 0, 1),
      evidence: normalizeInsightEvidence(object.evidence, batch[index])
    };
  });
}

function createOpenAiModel(options: ExtractionOptions) {
  if (!options.apiKey) {
    throw new Error("AI_API_KEY is required.");
  }

  const baseURL = options.baseUrl ?? DEFAULT_OPENAI_BASE_URL;
  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL,
    name: baseURL.includes("deepseek") ? "deepseek" : "openai"
  });

  const model = options.model ?? DEFAULT_OPENAI_MODEL;
  return baseURL.includes("deepseek") ? provider.chat(model) : provider(model);
}

async function callOpenAiCompatibleJson(input: {
  system: string;
  prompt: string;
  options: ExtractionOptions;
  maxTokens?: number;
}) {
  if (!input.options.apiKey) {
    throw new Error("AI_API_KEY is required.");
  }

  const baseURL = input.options.baseUrl ?? DEFAULT_OPENAI_BASE_URL;
  const model = input.options.model ?? DEFAULT_OPENAI_MODEL;
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.options.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt }
      ],
      temperature: 0.1,
      max_tokens: input.maxTokens ?? 4096,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(90_000)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI-compatible extraction failed: ${response.status} ${text.slice(0, 500)}`);
  }

  const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI-compatible extraction returned an empty message.");
  }

  return parseJsonObject(content);
}

async function extractWithVercelAiSdk(batch: RawNewsItem[], options: ExtractionOptions) {
  if ((options.baseUrl ?? DEFAULT_OPENAI_BASE_URL).includes("deepseek")) {
    const parsed = await callOpenAiCompatibleJson({
      options,
      system:
        "You are a strict AI industry intelligence extraction system. Return only valid JSON. Do not include markdown.",
      prompt: [
        buildExtractionPrompt(batch),
        "Return a JSON object with shape {\"items\": NewsInsight[]}. Each item must match the requested NewsInsight-like object shape."
      ].join("\n\n"),
      maxTokens: 8192
    });
    const items = (parsed as { items?: unknown[] }).items;
    if (!Array.isArray(items)) {
      throw new Error("DeepSeek extraction JSON did not contain an items array.");
    }
    const insights = NewsInsightSchema.omit({
      id: true,
      title: true,
      source: true,
      url: true,
      published_at: true
    }).array().parse(coerceNewsInsightItems(items, batch));
    return normalizeNewsInsights(insights, batch);
  }

  const result = await generateObject({
    model: createOpenAiModel(options),
    schema: NewsInsightSchema.omit({
      id: true,
      title: true,
      source: true,
      url: true,
      published_at: true
    }),
    output: "array",
    temperature: 0.1,
    system:
      "You are a strict AI industry intelligence extraction system. Return schema-valid structured insight objects only. Do not invent unsupported facts.",
    prompt: buildExtractionPrompt(batch)
  });

  return normalizeNewsInsights(result.object, batch);
}

async function callCloudflareRest(prompt: string, options: ExtractionOptions): Promise<string> {
  if (!options.cloudflareAccountId || !options.cloudflareApiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");
  }

  const model = options.cloudflareModel ?? "@cf/meta/llama-3.1-8b-instruct";
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${options.cloudflareAccountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.cloudflareApiToken}`
      },
      body: JSON.stringify({
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content:
              "You are a strict information extraction system. Return JSON that matches the requested schema."
          },
          { role: "user", content: prompt }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Cloudflare Workers AI REST failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { result?: { response?: string } };
  return data.result?.response ?? "";
}

function normalizeAiArticles(raw: unknown, batch: RawNewsItem[]): ArticleInsight[] {
  const object = raw as { articles?: unknown[] };
  const articles = Array.isArray(object.articles) ? object.articles : [];

  if (articles.length !== batch.length) {
    throw new Error(`AI returned ${articles.length} articles for a batch of ${batch.length}.`);
  }

  return articles.map((article, index) => {
    const articleObject =
      typeof article === "object" && article !== null ? article : {};

    const text = `${batch[index].title}. ${batch[index].summary}. ${batch[index].content}`;
    const topics = inferTopics(text);
    const category = inferCategory(topics);
    const eventType = inferEventType(text, topics);
    const organizations = inferOrganizations(text);
    const aiRelevance = calculateAiRelevance({
      text,
      sourceType: batch[index].sourceType,
      topics,
      organizations
    });
    const confidence = 0.78;
    const sentiment = (articleObject as { sentiment?: ArticleInsight["sentiment"] }).sentiment ?? "neutral";
    const risks = ((articleObject as { riskSignals?: string[] }).riskSignals ?? (articleObject as { impact?: { risks?: string[] } }).impact?.risks ?? buildRisks(topics));
    const opportunities =
      ((articleObject as { opportunitySignals?: string[] }).opportunitySignals ??
        (articleObject as { impact?: { opportunities?: string[] } }).impact?.opportunities ??
        buildOpportunities(topics));

    return ArticleInsightSchema.parse({
      ...articleObject,
      schemaVersion: ARTICLE_SCHEMA_VERSION,
      scoringVersion: SCORING_VERSION,
      id: stableId(`insight:${batch[index].id}`),
      rawId: batch[index].id,
      title: batch[index].title,
      sourceName: batch[index].sourceName,
      sourceType: batch[index].sourceType,
      sourceTypeNormalized: (articleObject as { sourceTypeNormalized?: unknown }).sourceTypeNormalized ?? normalizeSourceType(batch[index].sourceType),
      url: batch[index].url,
      publishedAt: batch[index].publishedAt,
      language: batch[index].language,
      languageNormalized: (articleObject as { languageNormalized?: unknown }).languageNormalized ?? normalizeLanguage(batch[index].language),
      category: (articleObject as { category?: unknown }).category ?? category,
      eventType: (articleObject as { eventType?: unknown }).eventType ?? eventType,
      summary: (articleObject as { summary?: unknown }).summary ?? truncateText(batch[index].summary, 220),
      keyFacts: (articleObject as { keyFacts?: unknown }).keyFacts ?? buildKeyFacts(batch[index], truncateText(batch[index].summary, 220), topics),
      impactAnalysis:
        (articleObject as { impactAnalysis?: unknown }).impactAnalysis ??
        (articleObject as { canonicalEvent?: { whyItMatters?: string } }).canonicalEvent?.whyItMatters ??
        "The item was validated by AI extraction and contributes to the daily intelligence signal.",
      entities: {
        ...((articleObject as { entities?: object }).entities ?? {}),
        organizations: (articleObject as { entities?: { organizations?: unknown } }).entities?.organizations ?? organizations,
        products: (articleObject as { entities?: { products?: unknown } }).entities?.products ?? inferProducts(text),
        people: (articleObject as { entities?: { people?: unknown } }).entities?.people ?? [],
        geographies: (articleObject as { entities?: { geographies?: unknown } }).entities?.geographies ?? inferGeographies(text),
        extracted: (articleObject as { entities?: { extracted?: unknown } }).entities?.extracted ?? inferExtractedEntities(text)
      },
      importanceScore:
        (articleObject as { importanceScore?: unknown }).importanceScore ??
        calculateImportanceScore({
          sourceType: batch[index].sourceType,
          organizations,
          category,
          eventType,
          sentiment,
          isRecent: Date.now() - new Date(batch[index].publishedAt).getTime() < 1000 * 60 * 60 * 24 * 10
        }),
      confidenceScore: (articleObject as { confidenceScore?: unknown }).confidenceScore ?? confidence,
      aiRelevance:
        (articleObject as { aiRelevance?: unknown }).aiRelevance ?? aiRelevance,
      riskSignals: risks,
      opportunitySignals: opportunities,
      evidence:
        (articleObject as { evidence?: unknown }).evidence ??
        [
          { field: "summary", quoteOrReason: truncateText(batch[index].summary, 180) },
          { field: "source_type", quoteOrReason: `${batch[index].sourceName} normalized to ${normalizeSourceType(batch[index].sourceType)}` }
        ],
      extractionMeta: {
        method: "ai",
        promptVersion: PROMPT_VERSION,
        schemaVersion: ARTICLE_SCHEMA_VERSION,
        scoringVersion: SCORING_VERSION,
        validatedAt: new Date().toISOString(),
        warnings: aiRelevance.tier === "noise" ? ["AI relevance gate classified this item as noise."] : []
      }
    });
  });
}

function normalizeNewsInsights(rawInsights: Array<Omit<NewsInsight, "id" | "title" | "source" | "url" | "published_at">>, batch: RawNewsItem[]): ArticleInsight[] {
  if (rawInsights.length !== batch.length) {
    throw new Error(`AI returned ${rawInsights.length} articles for a batch of ${batch.length}.`);
  }

  return rawInsights.map((insight, index) => {
    const item = batch[index];
    const text = `${item.title}. ${item.summary}. ${item.content}`;
    const topics = inferTopics(text);
    const valueChain = inferValueChain(text);
    const organizations = insight.entities
      .filter((entity) => entity.type === "company" || entity.type === "organization")
      .map((entity) => entity.name);
    const products = insight.entities
      .filter((entity) => entity.type === "model" || entity.type === "product" || entity.type === "technology")
      .map((entity) => entity.name);
    const aiRelevance = calculateAiRelevance({ text, sourceType: item.sourceType, topics, organizations });
    const uncappedScore = calculateAiImpactScore({
      importanceScore: insight.importance_score,
      confidenceScore: insight.confidence_score,
      sourceType: item.sourceType,
      eventType: insight.event_type,
      organizations,
      publishedAt: item.publishedAt,
      riskSignals: insight.risk_signals,
      opportunitySignals: insight.opportunity_signals
    });
    const score =
      aiRelevance.tier === "core"
        ? uncappedScore
        : aiRelevance.tier === "adjacent"
          ? Math.min(68, uncappedScore)
          : Math.min(38, uncappedScore);
    const horizon = insight.category === "policy" || insight.category === "security" ? "quarter" : "weeks";

    return ArticleInsightSchema.parse({
      schemaVersion: ARTICLE_SCHEMA_VERSION,
      scoringVersion: SCORING_VERSION,
      id: stableId(`insight:${item.id}`),
      rawId: item.id,
      title: item.title,
      sourceName: item.sourceName,
      sourceType: item.sourceType,
      sourceTypeNormalized: insight.source_type,
      url: item.url,
      publishedAt: item.publishedAt,
      language: item.language,
      languageNormalized: insight.language,
      category: insight.category,
      eventType: insight.event_type,
      summary: insight.summary,
      keyFacts: insight.key_facts,
      impactAnalysis: insight.impact_analysis,
      canonicalEvent: {
        whatHappened: insight.summary,
        whyItMatters: insight.impact_analysis,
        affectedActors: organizations.length > 0 ? organizations : ["AI ecosystem"],
        evidence: insight.evidence[0]?.quote_or_reason ?? insight.summary,
        confidence: insight.confidence_score
      },
      taxonomy: {
        topics,
        valueChain,
        maturity: insight.category === "research" ? "emerging" : score >= 80 ? "mainstream" : "signal"
      },
      impact: {
        score,
        horizon,
        stakeholders: Array.from(new Set([...organizations, ...products, "AI product teams"])),
        risks: insight.risk_signals,
        opportunities: insight.opportunity_signals
      },
      entities: {
        organizations,
        products,
        people: insight.entities.filter((entity) => entity.type === "person").map((entity) => entity.name),
        geographies: inferGeographies(text),
        extracted: insight.entities
      },
      signals: {
        novelty: insight.event_type === "launch" || insight.event_type === "upgrade" ? 4 : 3,
        adoption: insight.category === "industry_application" || insight.category === "ai_product" ? 4 : 2,
        technicalDepth: insight.category === "research" || insight.category === "model_release" ? 4 : 2,
        regulatoryWeight: insight.category === "policy" || insight.category === "security" ? 4 : 1,
        capitalIntensity: insight.event_type === "funding" || insight.category === "capital" ? 4 : 1
      },
      sentiment: insight.sentiment,
      importanceScore: Math.round(insight.importance_score),
      confidenceScore: insight.confidence_score,
      aiRelevance,
      riskSignals: insight.risk_signals,
      opportunitySignals: insight.opportunity_signals,
      evidence: insight.evidence.map((item) => ({
        field: item.field,
        quoteOrReason: item.quote_or_reason
      })),
      keywords: inferKeywords(text, topics),
      extractionMeta: {
        method: "ai",
        promptVersion: PROMPT_VERSION,
        schemaVersion: ARTICLE_SCHEMA_VERSION,
        scoringVersion: SCORING_VERSION,
        validatedAt: new Date().toISOString(),
        warnings: aiRelevance.tier === "noise" ? ["AI relevance gate classified this item as noise."] : []
      }
    });
  });
}

export async function extractArticles(
  items: RawNewsItem[],
  options: ExtractionOptions = {}
): Promise<ArticleInsight[]> {
  const provider = options.provider ?? "deterministic";
  const batchSize = options.batchSize ?? (provider === "openai_compatible" ? 20 : 5);
  const concurrency = Math.max(1, options.concurrency ?? (provider === "openai_compatible" ? 3 : 1));
  const batches: Array<{ start: number; batch: RawNewsItem[] }> = [];

  for (let start = 0; start < items.length; start += batchSize) {
    batches.push({ start, batch: items.slice(start, start + batchSize) });
  }

  async function extractBatch(start: number, batch: RawNewsItem[]): Promise<ArticleInsight[]> {
    if (provider === "deterministic") {
      return batch.map(extractDeterministic);
    }

    try {
      if (provider === "openai_compatible") {
        console.log(
          JSON.stringify({
            message: "ai extraction batch start",
            provider,
            model: options.model ?? DEFAULT_OPENAI_MODEL,
            start,
            count: batch.length
          })
        );
        const batchInsights = await extractWithVercelAiSdk(batch, options);
        console.log(
          JSON.stringify({
            message: "ai extraction batch complete",
            provider,
            model: options.model ?? DEFAULT_OPENAI_MODEL,
            start,
            count: batch.length
          })
        );
        return batchInsights;
      } else {
        const prompt = buildExtractionPrompt(batch);
        const content = await callCloudflareRest(prompt, options);
        try {
          return normalizeAiArticles(parseJsonObject(content), batch);
        } catch (validationError) {
          const error = validationError instanceof Error ? validationError.message : String(validationError);
          const repaired = await callCloudflareRest(buildRepairPrompt(batch, content, error), options);
          return normalizeAiArticles(parseJsonObject(repaired), batch);
        }
      }
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      console.warn(
        JSON.stringify({
          message: "ai extraction batch failed",
          provider,
          model: options.model ?? DEFAULT_OPENAI_MODEL,
          start,
          count: batch.length,
          error: warning
        })
      );
      if (provider === "openai_compatible" && batch.length > 1) {
        const splitAt = Math.ceil(batch.length / 2);
        console.warn(
          JSON.stringify({
            message: "ai extraction batch retry split",
            provider,
            model: options.model ?? DEFAULT_OPENAI_MODEL,
            start,
            count: batch.length,
            split: [splitAt, batch.length - splitAt]
          })
        );
        const [left, right] = await Promise.all([
          extractBatch(start, batch.slice(0, splitAt)),
          extractBatch(start + splitAt, batch.slice(splitAt))
        ]);
        return [...left, ...right];
      }
      for (const item of batch) {
        options.onFailure?.({
          rawId: item.id,
          title: item.title,
          sourceName: item.sourceName,
          stage: "repair",
          error: warning
        });
      }
      return [];
    }
  }

  const results: ArticleInsight[] = [];
  let nextBatchIndex = 0;
  const workerCount = Math.min(concurrency, batches.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextBatchIndex < batches.length) {
        const batchInfo = batches[nextBatchIndex];
        nextBatchIndex += 1;
        results.push(...(await extractBatch(batchInfo.start, batchInfo.batch)));
      }
    })
  );

  const insights = results;

  return insights.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function optionsFromEnv(env: NodeJS.ProcessEnv): ExtractionOptions {
  const provider = env.AI_PROVIDER as AiProvider | undefined;
  const resolvedProvider =
    provider === "openai_compatible" || provider === "cloudflare_rest"
      ? provider
      : env.AI_API_KEY
        ? "openai_compatible"
        : "deterministic";

  return {
    provider: resolvedProvider,
    apiKey: env.AI_API_KEY,
    baseUrl: env.AI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
    model: env.AI_MODEL ?? DEFAULT_OPENAI_MODEL,
    batchSize: env.AI_EXTRACTION_BATCH_SIZE ? Number.parseInt(env.AI_EXTRACTION_BATCH_SIZE, 10) : undefined,
    concurrency: env.AI_EXTRACTION_CONCURRENCY ? Number.parseInt(env.AI_EXTRACTION_CONCURRENCY, 10) : undefined,
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
    cloudflareModel: env.CLOUDFLARE_AI_MODEL
  };
}
