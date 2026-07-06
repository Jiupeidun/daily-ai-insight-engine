import { collectRawNewsDataset } from "./collect";
import { extractArticles, optionsFromEnv, type ExtractionFailure } from "./extract";
import { generateDailyReportWithAiSupport } from "./report";
import { DailyReportSchema, RawNewsItemSchema } from "./schema";
import { persistLatestReport, type ReportStoreEnv } from "../report-data";

export type RefreshEnv = ReportStoreEnv;

export async function runReportRefresh(env: RefreshEnv, source: "admin" | "cron" = "admin") {
  const startedAt = Date.now();
  const processEnv = env as NodeJS.ProcessEnv;
  const rawDataset = await collectRawNewsDataset(processEnv);
  const rawItems = RawNewsItemSchema.array().parse(rawDataset.items);
  const options = optionsFromEnv(processEnv);
  const failedRecords: ExtractionFailure[] = [];
  const articles = await extractArticles(rawItems, {
    ...options,
    onFailure: (failure) => failedRecords.push(failure)
  });
  const report = DailyReportSchema.parse(
    await generateDailyReportWithAiSupport(articles, rawItems.length, options)
  );
  const structured = {
    generatedAt: new Date().toISOString(),
    articles
  };
  const failed = {
    generatedAt: new Date().toISOString(),
    failedRecords
  };
  const meta = {
    generatedAt: new Date().toISOString(),
    source,
    provider: options.provider,
    model: options.model,
    rawItems: rawItems.length,
    structuredItems: articles.length,
    failedRecords: failedRecords.length,
    elapsedMs: Date.now() - startedAt
  };
  const persisted = await persistLatestReport(env, {
    rawDataset,
    structured,
    failedRecords: failed,
    report,
    meta
  });

  return {
    ...meta,
    persisted,
    rawDataset,
    structured,
    failedRecords: failed,
    report
  };
}
