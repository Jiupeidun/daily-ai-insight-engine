import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, Output } from "ai";
import type {
  ArticleInsight,
  EventType,
  InsightCategory,
  NewsInsight,
  RawNewsItem,
  SourceType,
  Topic,
  ValueChain
} from "./schema";
import { ArticleInsightSchema, NewsInsightSchema } from "./schema";
import { stableId, truncateText } from "./normalize";

export const PROMPT_VERSION = "extract-news-v1";
export const DEFAULT_OPENAI_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_OPENAI_MODEL = "deepseek-chat";

type AiProvider = "deterministic" | "openai_compatible" | "cloudflare_rest";

type ExtractionOptions = {
  provider?: AiProvider;
  batchSize?: number;
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

function normalizeSourceType(sourceType: SourceType) {
  if (sourceType === "official") return "official";
  if (sourceType === "research") return "research";
  if (sourceType === "social") return "social";
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
  const sourceWeight = input.sourceType === "official" ? 1 : input.sourceType === "tech_media" ? 0.5 : 0;
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
  const score = clampScore(
    38 +
      novelty * 6 +
      adoption * 5 +
      technicalDepth * 4 +
      regulatoryWeight * 3 +
      capitalIntensity * 3 +
      (isOfficial ? 6 : 0) +
      (isRecent ? 4 : 0)
  );
  const horizon = regulatoryWeight >= 4 ? "quarter" : adoption >= 4 ? "weeks" : "today";
  const firstSentence = truncateText(item.summary.split(/[.!?。！？]/)[0] ?? item.summary, 220);
  const sentiment = topics.includes("safety_security") || topics.includes("policy_regulation")
    ? "mixed"
    : "neutral";
  const category = inferCategory(topics);
  const eventType = inferEventType(text, topics);
  const risks = buildRisks(topics);
  const opportunities = buildOpportunities(topics);
  const confidence = isOfficial ? 0.86 : isResearch ? 0.78 : 0.7;

  return ArticleInsightSchema.parse({
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
      validatedAt: new Date().toISOString(),
      warnings: ["Generated by deterministic extractor because no validated AI response was used."]
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

function createOpenAiModel(options: ExtractionOptions) {
  if (!options.apiKey) {
    throw new Error("AI_API_KEY is required.");
  }

  const provider = createOpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl ?? DEFAULT_OPENAI_BASE_URL
  });

  return provider(options.model ?? DEFAULT_OPENAI_MODEL);
}

async function extractWithVercelAiSdk(batch: RawNewsItem[], options: ExtractionOptions) {
  if ((options.baseUrl ?? DEFAULT_OPENAI_BASE_URL).includes("deepseek")) {
    const result = await generateText({
      model: createOpenAiModel(options),
      output: Output.json(),
      temperature: 0.1,
      system:
        "You are a strict AI industry intelligence extraction system. Return only valid JSON. Do not include markdown.",
      prompt: [
        buildExtractionPrompt(batch),
        "Return a JSON array. Each item must match the requested NewsInsight-like object shape."
      ].join("\n\n")
    });

    const parsed = NewsInsightSchema.omit({
      id: true,
      title: true,
      source: true,
      url: true,
      published_at: true
    }).array().parse(result.output);
    return normalizeNewsInsights(parsed, batch);
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
    const confidence = 0.78;
    const sentiment = (articleObject as { sentiment?: ArticleInsight["sentiment"] }).sentiment ?? "neutral";
    const risks = ((articleObject as { riskSignals?: string[] }).riskSignals ?? (articleObject as { impact?: { risks?: string[] } }).impact?.risks ?? buildRisks(topics));
    const opportunities =
      ((articleObject as { opportunitySignals?: string[] }).opportunitySignals ??
        (articleObject as { impact?: { opportunities?: string[] } }).impact?.opportunities ??
        buildOpportunities(topics));

    return ArticleInsightSchema.parse({
      ...articleObject,
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
        validatedAt: new Date().toISOString(),
        warnings: []
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
    const score = clampScore(insight.importance_score * 20);
    const horizon = insight.category === "policy" || insight.category === "security" ? "quarter" : "weeks";
    const organizations = insight.entities
      .filter((entity) => entity.type === "company" || entity.type === "organization")
      .map((entity) => entity.name);
    const products = insight.entities
      .filter((entity) => entity.type === "model" || entity.type === "product" || entity.type === "technology")
      .map((entity) => entity.name);

    return ArticleInsightSchema.parse({
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
        validatedAt: new Date().toISOString(),
        warnings: []
      }
    });
  });
}

export async function extractArticles(
  items: RawNewsItem[],
  options: ExtractionOptions = {}
): Promise<ArticleInsight[]> {
  const provider = options.provider ?? "deterministic";
  const batchSize = options.batchSize ?? 5;
  const insights: ArticleInsight[] = [];

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);

    if (provider === "deterministic") {
      insights.push(...batch.map(extractDeterministic));
      continue;
    }

    try {
      if (provider === "openai_compatible") {
        insights.push(...(await extractWithVercelAiSdk(batch, options)));
      } else {
        const prompt = buildExtractionPrompt(batch);
        const content = await callCloudflareRest(prompt, options);
        try {
          insights.push(...normalizeAiArticles(parseJsonObject(content), batch));
        } catch (validationError) {
          const error = validationError instanceof Error ? validationError.message : String(validationError);
          const repaired = await callCloudflareRest(buildRepairPrompt(batch, content, error), options);
          insights.push(...normalizeAiArticles(parseJsonObject(repaired), batch));
        }
      }
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      for (const item of batch) {
        options.onFailure?.({
          rawId: item.id,
          title: item.title,
          sourceName: item.sourceName,
          stage: "repair",
          error: warning
        });
      }
    }
  }

  return insights.sort((a, b) => b.impact.score - a.impact.score);
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
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
    cloudflareModel: env.CLOUDFLARE_AI_MODEL
  };
}
