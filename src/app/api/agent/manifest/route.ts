import { NextResponse, type NextRequest } from "next/server";

function absoluteUrl(request: NextRequest, path: string) {
  return new URL(path, request.url).toString();
}

export function GET(request: NextRequest) {
  const manifest = {
    name: "Daily AI Insight Engine",
    version: "0.1.0",
    description:
      "Agent-readable interface for collecting, validating, analyzing, and exporting the latest AI industry daily report.",
    generatedAt: new Date().toISOString(),
    contract: {
      openapi: absoluteUrl(request, "/api/agent/openapi"),
      schema: absoluteUrl(request, "/api/agent/schema"),
      reportSchema: "DailyReportSchema in src/lib/insight/schema.ts",
      qualityModel:
        "Every report includes source statistics, schema rationale, quality gates, structured article insights, chart data, and methodology steps."
    },
    tools: [
      {
        name: "get_structured_schema_contract",
        method: "GET",
        endpoint: absoluteUrl(request, "/api/agent/schema"),
        auth: "none",
        purpose:
          "Fetch the machine-readable schema summary, refresh cadence, collection window, and agent usage rules.",
        output: "{ versions, refresh, articleInsight, report, agentRules }"
      },
      {
        name: "get_latest_ai_report",
        method: "GET",
        endpoint: absoluteUrl(request, "/api/report"),
        auth: "none",
        purpose:
          "Fetch the latest schema-validated AI daily report, including top events, deep dives, trend radar, risks, opportunities, charts, and source articles.",
        output: "DailyReport"
      },
      {
        name: "ask_ai_report",
        method: "POST",
        endpoint: absoluteUrl(request, "/api/analyze"),
        auth: "none",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              maxLength: 500,
              description: "A concise question about the latest structured report."
            }
          }
        },
        purpose:
          "Answer a natural-language analyst question using only the current structured report context.",
        output: "{ provider: string, model?: string, answer: string }"
      },
      {
        name: "download_ai_report_pdf",
        method: "POST",
        endpoint: absoluteUrl(request, "/api/report/pdf"),
        auth: "server AI configuration required",
        purpose:
          "Generate and download a PDF version of the latest AI daily report after AI synthesis passes validation.",
        output: "application/pdf"
      },
      {
        name: "refresh_ai_report",
        method: "POST",
        endpoint: absoluteUrl(request, "/api/admin/generate-report"),
        auth: "Bearer REPORT_ADMIN_TOKEN",
        purpose:
          "Run the full extraction and report-generation pipeline against the raw collected dataset.",
        output:
          "{ generatedAt, provider, structured: { generatedAt, articles }, failedRecords, report }"
      }
    ],
    agentGuidance: [
      "Call get_latest_ai_report before asking analytical follow-up questions.",
      "Use qualityGates and confidenceScore to decide whether a claim is safe to cite.",
      "Prefer citedUrls, evidence, and relatedArticleIds when composing downstream summaries.",
      "Use refresh_ai_report only in trusted automation because it can trigger model calls."
    ]
  };

  return NextResponse.json(manifest, {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300"
    }
  });
}
