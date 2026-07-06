import latestReport from "../../data/reports/latest.json";
import { DailyReportSchema, type DailyReport } from "./insight/schema";

export function getLatestReport(): DailyReport {
  return DailyReportSchema.parse(latestReport);
}
