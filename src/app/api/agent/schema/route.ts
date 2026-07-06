import { NextResponse } from "next/server";
import { ARTICLE_SCHEMA_VERSION, REPORT_SCHEMA_VERSION, SCORING_VERSION } from "@/lib/insight/schema";

export function GET() {
  return NextResponse.json(
    {
      name: "Daily AI Insight Engine Structured Contract",
      versions: {
        articleSchema: ARTICLE_SCHEMA_VERSION,
        reportSchema: REPORT_SCHEMA_VERSION,
        scoring: SCORING_VERSION
      },
      refresh: {
        scheduler: "Cloudflare Cron",
        cron: "0 */12 * * *",
        timezone: "UTC",
        beijingTime: ["08:00", "20:00"],
        collectionWindow: "previous Asia/Shanghai calendar day with backfill for source coverage"
      },
      articleInsight: {
        identity: ["id", "rawId", "schemaVersion", "scoringVersion"],
        sourceTrace: ["title", "sourceName", "sourceType", "url", "publishedAt", "language"],
        event: [
          "canonicalEvent.whatHappened",
          "canonicalEvent.whyItMatters",
          "canonicalEvent.affectedActors",
          "canonicalEvent.evidence",
          "canonicalEvent.confidence"
        ],
        taxonomy: ["category", "eventType", "taxonomy.topics", "taxonomy.valueChain", "taxonomy.maturity"],
        decisionFields: [
          "impact.score",
          "impact.horizon",
          "impact.stakeholders",
          "impact.risks",
          "impact.opportunities"
        ],
        signalFields: [
          "signals.novelty",
          "signals.adoption",
          "signals.technicalDepth",
          "signals.regulatoryWeight",
          "signals.capitalIntensity"
        ],
        auditFields: ["confidenceScore", "evidence", "riskSignals", "opportunitySignals", "extractionMeta"]
      },
      report: {
        sections: [
          "executiveBrief",
          "topEvents",
          "deepDives",
          "trendRadar",
          "riskOpportunity",
          "charts",
          "qualityGates",
          "methodology"
        ],
        sourceOfTruth: "/api/report",
        pdf: "/api/report/pdf"
      },
      agentRules: [
        "Use /api/report as the source of truth for facts.",
        "Preserve cited URLs, evidence fields, confidence scores, and relatedArticleIds in downstream summaries.",
        "Treat /api/analyze as grounded reasoning over the report, not as a replacement for report data.",
        "Use /api/admin/generate-report only with trusted Bearer auth because it triggers model calls and mutates KV state."
      ]
    },
    {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=3600"
      }
    }
  );
}
