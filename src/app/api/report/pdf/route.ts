import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import rawNews from "../../../../../data/raw/news-items.json";
import { extractArticles, optionsFromEnv } from "@/lib/insight/extract";
import { generateDailyReportWithAiSupport } from "@/lib/insight/report";
import { RawNewsItemSchema } from "@/lib/insight/schema";
import { renderDailyReportPdf } from "@/lib/pdf/render-report-pdf";

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

    const rawItems = RawNewsItemSchema.array().parse((rawNews as { items: unknown }).items);
    console.log(
      JSON.stringify({
        event: "report-pdf:raw-loaded",
        requestId,
        rawItems: rawItems.length
      })
    );
    const failedRecords: unknown[] = [];
    const articles = await extractArticles(rawItems, {
      ...options,
      onFailure: (failure) => failedRecords.push(failure)
    });
    const aiItems = articles.filter((article) => article.extractionMeta.method === "ai").length;
    console.log(
      JSON.stringify({
        event: "report-pdf:extracted",
        requestId,
        articles: articles.length,
        aiItems,
        failedRecords: failedRecords.length,
        elapsedMs: Date.now() - startedAt
      })
    );
    const report = await generateDailyReportWithAiSupport(articles, rawItems.length, options);
    const synthesisGate = report.qualityGates.find((gate) => gate.name === "AI report synthesis");
    console.log(
      JSON.stringify({
        event: "report-pdf:synthesized",
        requestId,
        synthesisStatus: synthesisGate?.status ?? "missing",
        elapsedMs: Date.now() - startedAt
      })
    );

    if (aiItems === 0 || synthesisGate?.status !== "pass") {
      console.warn(
        JSON.stringify({
          event: "report-pdf:validation-failed",
          requestId,
          aiItems,
          failedRecords: failedRecords.length,
          synthesisStatus: synthesisGate?.status ?? "missing",
          synthesisRationale: synthesisGate?.rationale
        })
      );
      return NextResponse.json(
        {
          error: "OpenAI report generation did not pass validation.",
          requestId,
          aiItems,
          failedRecords,
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
        "x-ai-items": String(aiItems)
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
