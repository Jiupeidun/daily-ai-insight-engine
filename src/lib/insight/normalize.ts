import { createHash } from "node:crypto";
import type { Language, RawNewsItem, SourceManifest } from "./schema";
import { RawNewsItemSchema } from "./schema";

const AI_PATTERNS = [
  /\bAI\b/i,
  /\bartificial intelligence\b/i,
  /\bgenerative AI\b/i,
  /\bLLMs?\b/i,
  /\blanguage models?\b/i,
  /\bmachine learning\b/i,
  /\bdeep learning\b/i,
  /\bneural\b/i,
  /\binference\b/i,
  /\bagents?\b/i,
  /\bcopilot\b/i,
  /\bGPU(s)?\b/i,
  /\baccelerators?\b/i,
  /\bsemiconductors?\b/i,
  /\bchips?\b/i,
  /\bHBM\b/i,
  /\bDRAM\b/i,
  /\bmemory\b/i,
  /\bstorage\b/i,
  /\bdata centers?\b/i,
  /\bdatacenters?\b/i,
  /\bcloud capex\b/i,
  /\bAI capex\b/i,
  /\bNVDA\b/i,
  /\bAMD\b/i,
  /\bTSMC\b/i,
  /\bBroadcom\b/i,
  /\bMicron\b/i,
  /\bSuper Micro\b/i,
  /\bOpenAI\b/i,
  /\bAnthropic\b/i,
  /\bChatGPT\b/i,
  /\bClaude\b/i,
  /\bGemini\b/i,
  /\bLlama\b/i,
  /\bMistral\b/i,
  /\bNvidia\b/i,
  /人工智能/,
  /大模型/,
  /生成式/,
  /智能体/,
  /机器学习/,
  /深度学习/,
  /神经网络/,
  /算力/,
  /芯片/,
  /半导体/,
  /数据中心/,
  /存储/,
  /内存/,
  /云计算/,
  /资本开支/,
  /英伟达/,
  /台积电/,
  /博通/,
  /美光/,
  /Robotaxi/i,
  /世界模型/,
  /自动驾驶/,
  /辅助驾驶/
];

export function stableId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength - 1).trim()}...`;
}

export function detectLanguage(input: string): Language {
  const chineseChars = input.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = input.match(/[a-zA-Z]{3,}/g)?.length ?? 0;

  if (chineseChars > 12 && latinWords > 12) {
    return "mixed";
  }

  if (chineseChars > 12) {
    return "zh";
  }

  return "en";
}

export function parseDate(input: unknown): string {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString();
  }

  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

export function looksAiRelated(item: Pick<RawNewsItem, "title" | "summary" | "content">): boolean {
  const haystack = `${item.title} ${item.summary}`;
  return AI_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function titleLooksAiRelated(title: string): boolean {
  return AI_PATTERNS.some((pattern) => pattern.test(title));
}

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (key.startsWith("utm_") || key === "ref" || key === "guccounter") {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildRawNewsItem(input: {
  title: string;
  summary?: string;
  content?: string;
  url: string;
  source: SourceManifest;
  publishedAt?: unknown;
  authors?: string[];
  rawTags?: string[];
  collectedAt?: string;
}): RawNewsItem {
  const title = stripHtml(input.title);
  const summarySource = stripHtml(input.summary ?? input.content ?? title);
  const summary = truncateText(
    summarySource.length >= 16 ? summarySource : `${title} from ${input.source.name}`,
    1200
  );
  const content = truncateText(stripHtml(input.content ?? input.summary ?? ""), 3000);
  const url = canonicalizeUrl(input.url);
  const textForLanguage = `${title} ${summary} ${content}`;

  return RawNewsItemSchema.parse({
    id: stableId(`${url}:${title}`),
    title,
    summary,
    content,
    url,
    sourceName: input.source.name,
    sourceUrl: input.source.url,
    sourceType: input.source.type,
    publishedAt: parseDate(input.publishedAt),
    collectedAt: input.collectedAt ?? new Date().toISOString(),
    language: detectLanguage(textForLanguage),
    authors: input.authors ?? [],
    rawTags: input.rawTags ?? []
  });
}

export function dedupeNewsItems(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Map<string, RawNewsItem>();

  for (const item of items) {
    const key = stableId(`${canonicalizeUrl(item.url)}:${item.title.toLowerCase()}`);
    const existing = seen.get(key);
    if (!existing || existing.summary.length < item.summary.length) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
