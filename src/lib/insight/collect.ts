import Parser from "rss-parser";
import { NEWS_SOURCES, SOURCE_MANIFEST } from "./source-config";
import {
  buildRawNewsItem,
  dedupeNewsItems,
  looksAiRelated,
  stableId,
  titleLooksAiRelated
} from "./normalize";
import type { RawNewsItem } from "./schema";

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: unknown;
  author?: unknown;
  categories?: unknown[];
  content?: string;
  contentSnippet?: string;
  summary?: string;
  "content:encoded"?: string;
};

type CollectOptions = {
  targetCount?: number;
  perSourceLimit?: number;
  timezoneOffsetMinutes?: number;
  lookbackHours?: number;
  backfillDays?: number;
  feedTimeoutMs?: number;
};

const parser = new Parser<unknown, FeedItem>({
  headers: {
    "user-agent":
      "DailyAIInsightEngine/0.1 (+https://github.com/Jiupeidun/daily-ai-insight-engine)"
  }
});

function numberFromEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function collectOptionsFromEnv(env: NodeJS.ProcessEnv): Required<CollectOptions> {
  return {
    targetCount: numberFromEnv(env.NEWS_LIMIT, 120),
    perSourceLimit: numberFromEnv(env.NEWS_PER_SOURCE_LIMIT, 50),
    timezoneOffsetMinutes: numberFromEnv(env.REPORT_TIMEZONE_OFFSET_MINUTES, 480),
    lookbackHours: numberFromEnv(env.REPORT_LOOKBACK_HOURS, 12),
    backfillDays: numberFromEnv(env.NEWS_BACKFILL_DAYS, 7),
    feedTimeoutMs: numberFromEnv(env.FEED_TIMEOUT_MS, 45_000)
  };
}

function getRecentWindow(now: Date, lookbackHours: number) {
  return {
    start: new Date(now.getTime() - lookbackHours * 60 * 60 * 1000),
    end: now
  };
}

function getBackfillWindow(primaryWindow: { start: Date; end: Date }, backfillDays: number) {
  return {
    start: new Date(primaryWindow.end.getTime() - backfillDays * 24 * 60 * 60 * 1000),
    end: primaryWindow.end
  };
}

function isInsideWindow(item: RawNewsItem, window: { start: Date; end: Date }) {
  const publishedAt = new Date(item.publishedAt).getTime();
  return publishedAt >= window.start.getTime() && publishedAt < window.end.getTime();
}

function authorsFromItem(item: FeedItem): string[] {
  return [item.creator, item.author]
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (value && typeof value === "object" && "name" in value) {
        const name = (value as { name?: unknown }).name;
        return typeof name === "string" ? [name] : [];
      }
      return [];
    })
    .filter((value) => value.trim().length > 0);
}

function tagsFromItem(item: FeedItem): string[] {
  return (item.categories ?? [])
    .flatMap((category) => {
      if (typeof category === "string") return [category];
      if (category && typeof category === "object") {
        return Object.values(category).filter((value): value is string => typeof value === "string");
      }
      return [];
    })
    .filter((value) => value.trim().length > 0);
}

function passesSourceQuality(sourceId: string, item: RawNewsItem): boolean {
  const titleStrictSources = new Set(["36kr-feed", "ithome-feed"]);
  if (titleStrictSources.has(sourceId)) {
    return titleLooksAiRelated(item.title);
  }

  return looksAiRelated(item);
}

function diversifyNewsItems(
  groups: Array<{ sourceId: string; items: RawNewsItem[] }>,
  targetCount: number
): RawNewsItem[] {
  const selected: RawNewsItem[] = [];
  const seen = new Set<string>();
  const maxGroupLength = groups.reduce(
    (maxLength, group) => Math.max(maxLength, group.items.length),
    0
  );

  for (let index = 0; index < maxGroupLength && selected.length < targetCount; index += 1) {
    for (const group of groups) {
      const item = group.items[index];
      if (!item) continue;

      const key = stableId(`${item.url}:${item.title.toLowerCase()}`);
      if (seen.has(key)) continue;

      selected.push(item);
      seen.add(key);

      if (selected.length >= targetCount) break;
    }
  }

  return selected.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

async function fetchFeedText(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "DailyAIInsightEngine/0.1 (+https://github.com/Jiupeidun/daily-ai-insight-engine)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Feed request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function collectSource(
  source: (typeof NEWS_SOURCES)[number],
  primaryWindow: { start: Date; end: Date },
  backfillWindow: { start: Date; end: Date },
  options: Required<CollectOptions>
): Promise<RawNewsItem[]> {
  const xml = await fetchFeedText(source.url, options.feedTimeoutMs);
  const feed = await parser.parseString(xml);
  const collectedAt = new Date().toISOString();

  return feed.items.slice(0, options.perSourceLimit).flatMap((item) => {
    if (!item.title || !(item.link ?? item.guid)) return [];

    try {
      const raw = buildRawNewsItem({
        title: item.title,
        summary: item.contentSnippet ?? item.summary ?? item.content,
        content: item["content:encoded"] ?? item.content,
        url: item.link ?? item.guid ?? source.url,
        source,
        publishedAt: item.isoDate ?? item.pubDate,
        authors: authorsFromItem(item),
        rawTags: tagsFromItem(item),
        collectedAt
      });

      return passesSourceQuality(source.id, raw) && isInsideWindow(raw, backfillWindow) ? [raw] : [];
    } catch {
      return [];
    }
  });
}

export async function collectRawNewsDataset(
  env: NodeJS.ProcessEnv,
  now = new Date()
) {
  const options = collectOptionsFromEnv(env);
  const collected: RawNewsItem[] = [];
  const collectedBySource: Array<{ sourceId: string; items: RawNewsItem[] }> = [];
  const failures: Array<{ source: string; error: string }> = [];
  const window = getRecentWindow(now, options.lookbackHours);
  const backfillWindow = getBackfillWindow(window, options.backfillDays);

  for (const source of NEWS_SOURCES) {
    try {
      const items = await collectSource(source, window, backfillWindow, options);
      collected.push(...items);
      collectedBySource.push({ sourceId: source.id, items: dedupeNewsItems(items) });
      console.log(JSON.stringify({ message: "source collected", source: source.id, items: items.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ source: source.id, error: message });
      console.warn(JSON.stringify({ message: "source failed", source: source.id, error: message }));
    }
  }

  const deduped = dedupeNewsItems(collected);
  const primaryItems = deduped.filter((item) => isInsideWindow(item, window));
  const items = diversifyNewsItems(collectedBySource, options.targetCount);

  if (items.length < 10) {
    throw new Error(
      `Only collected ${items.length} AI-related items. Try increasing NEWS_PER_SOURCE_LIMIT or checking RSS source availability.`
    );
  }

  return {
    collectedAt: new Date().toISOString(),
    window: {
      mode: "rolling_12h_with_backfill",
      lookbackHours: options.lookbackHours,
      timezoneOffsetMinutes: options.timezoneOffsetMinutes,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      backfillStart: backfillWindow.start.toISOString(),
      backfillDays: options.backfillDays,
      primaryItemCount: primaryItems.length,
      backfillItemCount: Math.max(0, items.length - primaryItems.length)
    },
    targetCount: options.targetCount,
    candidateCount: deduped.length,
    failures,
    sourceManifest: SOURCE_MANIFEST,
    items
  };
}
