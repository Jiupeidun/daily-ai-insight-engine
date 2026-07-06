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
  const env = getRuntimeEnv();
  const options = optionsFromEnv(env);

  if (options.provider !== "openai_compatible" || !options.apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured for report generation." },
      { status: 503 }
    );
  }

  const rawItems = RawNewsItemSchema.array().parse((rawNews as { items: unknown }).items);
  const articles = await extractArticles(rawItems, options);
  const aiItems = articles.filter((article) => article.extractionMeta.method === "ai").length;
  const report = await generateDailyReportWithAiSupport(articles, rawItems.length, options);
  const synthesisGate = report.qualityGates.find((gate) => gate.name === "AI report synthesis");

  if (aiItems === 0 || synthesisGate?.status !== "pass") {
    return NextResponse.json(
      {
        error: "OpenAI report generation did not pass validation.",
        aiItems,
        synthesisStatus: synthesisGate?.status ?? "missing",
        synthesisRationale: synthesisGate?.rationale
      },
      { status: 502 }
    );
  }

  const pdf = await renderDailyReportPdf(report);
  const fileName = `AI-insight-report-${report.generatedAt.slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-ai-provider": options.provider,
      "x-ai-model": options.model ?? "",
      "x-ai-items": String(aiItems)
    }
  });
}
