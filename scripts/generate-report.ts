import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractArticles, optionsFromEnv } from "../src/lib/insight/extract";
import { generateDailyReport } from "../src/lib/insight/report";
import {
  DailyReportSchema,
  RawNewsItemSchema,
  type DailyReport
} from "../src/lib/insight/schema";

const ROOT = process.cwd();
const RAW_FILE = path.join(ROOT, "data/raw/news-items.json");
const PROCESSED_DIR = path.join(ROOT, "data/processed");
const REPORT_DIR = path.join(ROOT, "data/reports");

async function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = await readFile(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

async function readRawItems() {
  const raw = JSON.parse(await readFile(RAW_FILE, "utf8")) as { items?: unknown };
  return RawNewsItemSchema.array().parse(raw.items);
}

function reportToMarkdown(report: DailyReport): string {
  const quality = report.qualityGates
    .map((gate) => `- ${gate.status.toUpperCase()} ${gate.name}: ${gate.value} - ${gate.rationale}`)
    .join("\n");
  const topEvents = report.topEvents
    .map(
      (event) =>
        `${event.rank}. ${event.title} (${event.score}/100)\n   - Why: ${event.whyImportant}\n   - Evidence: ${event.evidence}\n   - Source: ${event.url}`
    )
    .join("\n");
  const deepDives = report.deepDives
    .map(
      (item) =>
        `### ${item.headline}\n\nBackground: ${item.background}\n\nImpact: ${item.impact}\n\nWatch next: ${item.watchNext}`
    )
    .join("\n\n");
  const trends = report.trendRadar
    .map((trend) => `- ${trend.theme}: ${trend.intensity}/100, ${trend.direction}. ${trend.rationale}`)
    .join("\n");
  const risks = report.riskOpportunity
    .map((item) => `- ${item.type.toUpperCase()} ${item.title}: ${item.rationale}`)
    .join("\n");

  return `# ${report.title}

Generated at: ${report.generatedAt}

Coverage: ${report.coverageWindow.start} to ${report.coverageWindow.end}

## Executive Brief

${report.executiveBrief}

## Quality Gates

${quality}

## Top Events

${topEvents}

## Deep Dives

${deepDives}

## Trend Radar

${trends}

## Risks and Opportunities

${risks}

## Schema Rationale

${report.schemaRationale.map((item) => `- ${item}`).join("\n")}

## Methodology

${report.methodology.map((item) => `- ${item.step}: ${item.detail}`).join("\n")}
`;
}

async function main() {
  await loadEnvFile(path.join(ROOT, ".env.local"));
  await loadEnvFile(path.join(ROOT, ".env"));

  const rawItems = await readRawItems();
  const options = optionsFromEnv(process.env);
  const articles = await extractArticles(rawItems, options);
  const report = DailyReportSchema.parse(generateDailyReport(articles, rawItems.length));

  await mkdir(PROCESSED_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  await writeFile(
    path.join(PROCESSED_DIR, "structured-news.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), articles }, null, 2)}\n`
  );
  await writeFile(path.join(REPORT_DIR, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(REPORT_DIR, "latest.md"), `${reportToMarkdown(report)}\n`);

  console.log(
    JSON.stringify({
      message: "report generated",
      provider: options.provider,
      rawItems: rawItems.length,
      structuredItems: articles.length,
      report: "data/reports/latest.json"
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
