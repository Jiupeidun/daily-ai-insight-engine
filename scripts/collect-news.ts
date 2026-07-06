import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";
import { NEWS_SOURCES, SOURCE_MANIFEST } from "../src/lib/insight/source-config";
import {
  buildRawNewsItem,
  dedupeNewsItems,
  looksAiRelated,
  stableId,
  titleLooksAiRelated
} from "../src/lib/insight/normalize";
import type { RawNewsItem } from "../src/lib/insight/schema";

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
  author?: string;
  categories?: string[];
  content?: string;
  contentSnippet?: string;
  summary?: string;
  "content:encoded"?: string;
};

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data/raw");
const TARGET_COUNT = Number.parseInt(process.env.NEWS_LIMIT ?? "18", 10);
const PER_SOURCE_LIMIT = Number.parseInt(process.env.NEWS_PER_SOURCE_LIMIT ?? "6", 10);

const parser = new Parser<unknown, FeedItem>({
  timeout: 12000,
  headers: {
    "user-agent":
      "DailyAIInsightEngine/0.1 (+https://github.com/Jiupeidun/daily-ai-insight-engine)"
  }
});

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
      if (!item) {
        continue;
      }

      const key = stableId(`${item.url}:${item.title.toLowerCase()}`);
      if (seen.has(key)) {
        continue;
      }

      selected.push(item);
      seen.add(key);

      if (selected.length >= targetCount) {
        break;
      }
    }
  }

  return selected.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function authorsFromItem(item: FeedItem): string[] {
  return [item.creator, item.author].filter((value): value is string => Boolean(value));
}

function passesSourceQuality(sourceId: string, item: RawNewsItem): boolean {
  const titleStrictSources = new Set(["36kr-feed", "ithome-feed"]);
  if (titleStrictSources.has(sourceId)) {
    return titleLooksAiRelated(item.title);
  }

  return looksAiRelated(item);
}

async function collectSource(source: (typeof NEWS_SOURCES)[number]): Promise<RawNewsItem[]> {
  const feed = await parser.parseURL(source.url);
  const collectedAt = new Date().toISOString();

  return feed.items
    .slice(0, PER_SOURCE_LIMIT)
    .flatMap((item) => {
      if (!item.title || !(item.link ?? item.guid)) {
        return [];
      }

      try {
        const raw = buildRawNewsItem({
          title: item.title,
          summary: item.contentSnippet ?? item.summary ?? item.content,
          content: item["content:encoded"] ?? item.content,
          url: item.link ?? item.guid ?? source.url,
          source,
          publishedAt: item.isoDate ?? item.pubDate,
          authors: authorsFromItem(item),
          rawTags: item.categories ?? [],
          collectedAt
        });

        return passesSourceQuality(source.id, raw) ? [raw] : [];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(JSON.stringify({ message: "skip invalid feed item", source: source.id, error: message }));
        return [];
      }
    });
}

async function main() {
  const collected: RawNewsItem[] = [];
  const collectedBySource: Array<{ sourceId: string; items: RawNewsItem[] }> = [];
  const failures: Array<{ source: string; error: string }> = [];

  for (const source of NEWS_SOURCES) {
    try {
      const items = await collectSource(source);
      collected.push(...items);
      collectedBySource.push({ sourceId: source.id, items: dedupeNewsItems(items) });
      console.log(
        JSON.stringify({
          message: "source collected",
          source: source.id,
          items: items.length
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ source: source.id, error: message });
      console.warn(JSON.stringify({ message: "source failed", source: source.id, error: message }));
    }
  }

  const deduped = dedupeNewsItems(collected);
  const items = diversifyNewsItems(collectedBySource, TARGET_COUNT);

  if (items.length < 10) {
    throw new Error(
      `Only collected ${items.length} AI-related items. Try increasing NEWS_PER_SOURCE_LIMIT or checking RSS source availability.`
    );
  }

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    path.join(RAW_DIR, "news-items.json"),
    `${JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        targetCount: TARGET_COUNT,
        candidateCount: deduped.length,
        failures,
        items
      },
      null,
      2
    )}\n`
  );
  await writeFile(
    path.join(RAW_DIR, "source-manifest.json"),
    `${JSON.stringify(SOURCE_MANIFEST, null, 2)}\n`
  );

  console.log(
    JSON.stringify({
      message: "raw dataset written",
      items: items.length,
      failures: failures.length,
      path: "data/raw/news-items.json"
    })
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
