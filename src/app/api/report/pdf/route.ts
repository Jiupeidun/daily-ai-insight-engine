import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { optionsFromEnv } from "@/lib/insight/extract";
import { generateDailyReportWithAiSupport } from "@/lib/insight/report";
import { renderDailyReportPdf } from "@/lib/pdf/render-report-pdf";
import { getLatestReport } from "@/lib/report-data";

type RuntimeEnv = NodeJS.ProcessEnv;

function getRuntimeEnv(): RuntimeEnv {
  try {
    return getCloudflareContext({ async: false }).env as RuntimeEnv;
  } catch {
    return process.env;
  }
}

export async function POST() {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const env = getRuntimeEnv();
    const options = optionsFromEnv(env);
    console.log(
      JSON.stringify({
        event: "report-pdf:start",
        requestId,
        provider: options.provider,
        model: options.model,
        hasApiKey: Boolean(options.apiKey)
      })
    );

    if (options.provider !== "openai_compatible" || !options.apiKey) {
      console.warn(
        JSON.stringify({
          event: "report-pdf:missing-openai-config",
          requestId,
          provider: options.provider,
          hasApiKey: Boolean(options.apiKey)
        })
      );
      return NextResponse.json(
        { error: "OpenAI API key is not configured for report generation.", requestId },
        { status: 503 }
      );
    }

    const latestReport = getLatestReport();
    console.log(
      JSON.stringify({
        event: "report-pdf:latest-report-loaded",
        requestId,
        articles: latestReport.articles.length,
        sourceCount: latestReport.sourceStats.sourceCount
      })
    );
    const sourceAiItems = latestReport.articles.filter(
      (article) => article.extractionMeta.method === "ai"
    ).length;
    console.log(
      JSON.stringify({
        event: "report-pdf:ai-synthesis-start",
        requestId,
        sourceAiItems,
        elapsedMs: Date.now() - startedAt
      })
    );
    const report = await generateDailyReportWithAiSupport(
      latestReport.articles,
      latestReport.sourceStats.rawCount,
      options
    );
    const synthesisGate = report.qualityGates.find((gate) => gate.name === "AI report synthesis");
    console.log(
      JSON.stringify({
        event: "report-pdf:synthesized",
        requestId,
        synthesisStatus: synthesisGate?.status ?? "missing",
        elapsedMs: Date.now() - startedAt
      })
    );

    if (synthesisGate?.status !== "pass") {
      console.warn(
        JSON.stringify({
          event: "report-pdf:validation-failed",
          requestId,
          sourceAiItems,
          synthesisStatus: synthesisGate?.status ?? "missing",
          synthesisRationale: synthesisGate?.rationale
        })
      );
      return NextResponse.json(
        {
          error: "OpenAI report generation did not pass validation.",
          requestId,
          sourceAiItems,
          synthesisStatus: synthesisGate?.status ?? "missing",
          synthesisRationale: synthesisGate?.rationale
        },
        { status: 502 }
      );
    }

    const pdf = await renderDailyReportPdf(report);
    const fileName = `AI-insight-report-${report.generatedAt.slice(0, 10)}.pdf`;
    console.log(
      JSON.stringify({
        event: "report-pdf:pdf-rendered",
        requestId,
        bytes: pdf.byteLength,
        elapsedMs: Date.now() - startedAt
      })
    );

    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
        "x-request-id": requestId,
        "x-ai-provider": options.provider,
        "x-ai-model": options.model ?? "",
        "x-ai-synthesis": synthesisGate?.status ?? "missing",
        "x-source-ai-items": String(sourceAiItems)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      JSON.stringify({
        event: "report-pdf:error",
        requestId,
        message,
        stack,
        elapsedMs: Date.now() - startedAt
      })
    );
    return NextResponse.json(
      {
        error: "Report PDF generation failed.",
        requestId,
        detail: message
      },
      { status: 500 }
    );
  }
}
