import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderDailyReportPdf } from "../src/lib/pdf/render-report-pdf";
import type { DailyReport } from "../src/lib/insight/schema";

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "data/reports/latest.json");
const OUTPUT_DIR = path.join(ROOT, "data/reports");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "latest-ai-insight-report.pdf");

function readReport(): DailyReport {
  return JSON.parse(readFileSync(REPORT_PATH, "utf8")) as DailyReport;
}

async function generatePdf(report: DailyReport) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, await renderDailyReportPdf(report));
}

async function main() {
  const report = readReport();
  await generatePdf(report);
  console.log(`Generated ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
