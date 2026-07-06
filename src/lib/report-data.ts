import latestReport from "../../data/reports/latest.json";
import { DailyReportSchema, type DailyReport } from "./insight/schema";

const REPORT_KEY = "latest:report";
const RAW_KEY = "latest:raw-news";
const STRUCTURED_KEY = "latest:structured-news";
const FAILED_KEY = "latest:failed-records";
const REFRESH_META_KEY = "latest:refresh-meta";

export type ReportStoreEnv = {
  [key: string]: unknown;
  REPORT_KV?: {
    get: (key: string, type: "json") => Promise<unknown>;
    put: (key: string, value: string) => Promise<unknown>;
  };
};

export function getBundledLatestReport(): DailyReport {
  return DailyReportSchema.parse(latestReport);
}

export async function getStoredLatestReport(env?: ReportStoreEnv): Promise<DailyReport | null> {
  if (!env?.REPORT_KV) {
    return null;
  }

  const stored = await env.REPORT_KV.get(REPORT_KEY, "json");
  return stored ? DailyReportSchema.parse(stored) : null;
}

export async function getLatestReport(env?: ReportStoreEnv): Promise<DailyReport> {
  return (await getStoredLatestReport(env)) ?? getBundledLatestReport();
}

export async function persistLatestReport(
  env: ReportStoreEnv,
  payload: {
    rawDataset: unknown;
    structured: unknown;
    failedRecords: unknown;
    report: DailyReport;
    meta: unknown;
  }
) {
  if (!env.REPORT_KV) {
    return false;
  }

  await Promise.all([
    env.REPORT_KV.put(REPORT_KEY, JSON.stringify(payload.report)),
    env.REPORT_KV.put(RAW_KEY, JSON.stringify(payload.rawDataset)),
    env.REPORT_KV.put(STRUCTURED_KEY, JSON.stringify(payload.structured)),
    env.REPORT_KV.put(FAILED_KEY, JSON.stringify(payload.failedRecords)),
    env.REPORT_KV.put(REFRESH_META_KEY, JSON.stringify(payload.meta))
  ]);

  return true;
}
