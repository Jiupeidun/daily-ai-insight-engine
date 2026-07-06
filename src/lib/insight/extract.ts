import type {
  ArticleInsight,
  RawNewsItem,
  Topic,
  ValueChain
} from "./schema";
import { ArticleInsightSchema } from "./schema";
import { stableId, truncateText } from "./normalize";

export const PROMPT_VERSION = "extract-news-v1";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

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

  return ArticleInsightSchema.parse({
    id: stableId(`insight:${item.id}`),
    rawId: item.id,
    title: item.title,
    sourceName: item.sourceName,
    sourceType: item.sourceType,
    url: item.url,
    publishedAt: item.publishedAt,
    language: item.language,
    canonicalEvent: {
      whatHappened: firstSentence,
      whyItMatters:
        score >= 75
          ? "This item has strong near-term impact because it combines credible source signal with product, market, or technical change."
          : "This item contributes to the daily signal set and helps triangulate where AI attention is moving.",
      affectedActors: organizations,
      evidence: truncateText(item.summary, 260),
      confidence: isOfficial ? 0.86 : isResearch ? 0.78 : 0.7
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
      risks: buildRisks(topics),
      opportunities: buildOpportunities(topics)
    },
    entities: {
      organizations,
      products: inferProducts(text),
      people: [],
      geographies: inferGeographies(text)
    },
    signals: {
      novelty,
      adoption,
      technicalDepth,
      regulatoryWeight,
      capitalIntensity
    },
    sentiment: topics.includes("safety_security") || topics.includes("policy_regulation")
      ? "mixed"
      : "neutral",
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
    "For each article, extract: canonical event, affected actors, topics, value chain, impact score, risks, opportunities, entities, signals, sentiment, and keywords.",
    "Use the article summary as evidence. Do not invent facts that are not supported by the item.",
    "Expected output shape: {\"articles\": ArticleInsight[]}.",
    "Allowed topics: frontier_model, ai_infrastructure, product_launch, research, open_source, policy_regulation, capital_market, safety_security, enterprise_adoption, developer_tools.",
    "Allowed valueChain: model, data, compute, application, tooling, governance, market.",
    JSON.stringify({ batch }, null, 2)
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

async function callOpenAiCompatible(prompt: string, options: ExtractionOptions): Promise<string> {
  if (!options.apiKey) {
    throw new Error("AI_API_KEY is required.");
  }

  const baseUrl = (options.baseUrl ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
  const model = options.model ?? DEFAULT_OPENAI_MODEL;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict information extraction system. Return JSON that matches the requested schema."
        },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible API failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
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

    return ArticleInsightSchema.parse({
      ...articleObject,
      id: stableId(`insight:${batch[index].id}`),
      rawId: batch[index].id,
      title: batch[index].title,
      sourceName: batch[index].sourceName,
      sourceType: batch[index].sourceType,
      url: batch[index].url,
      publishedAt: batch[index].publishedAt,
      language: batch[index].language,
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
  const batchSize = options.batchSize ?? 4;
  const insights: ArticleInsight[] = [];

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);

    if (provider === "deterministic") {
      insights.push(...batch.map(extractDeterministic));
      continue;
    }

    try {
      const prompt = buildExtractionPrompt(batch);
      const content =
        provider === "cloudflare_rest"
          ? await callCloudflareRest(prompt, options)
          : await callOpenAiCompatible(prompt, options);
      insights.push(...normalizeAiArticles(parseJsonObject(content), batch));
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      insights.push(
        ...batch.map((item) => {
          const fallback = extractDeterministic(item);
          return {
            ...fallback,
            extractionMeta: {
              ...fallback.extractionMeta,
              warnings: [warning, ...fallback.extractionMeta.warnings]
            }
          };
        })
      );
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
