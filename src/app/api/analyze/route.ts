import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { getLatestReport } from "@/lib/report-data";

function buildContext() {
  const report = getLatestReport();
  const topEvents = report.topEvents
    .slice(0, 5)
    .map((event) => `${event.rank}. ${event.title} (${event.score}/100): ${event.whyImportant}`)
    .join("\n");

  return [
    report.executiveBrief,
    "Top events:",
    topEvents,
    "Trend radar:",
    report.trendRadar.map((trend) => `${trend.theme}: ${trend.intensity}/100 ${trend.direction}`).join("\n")
  ].join("\n\n");
}

function fallbackAnswer(question: string) {
  const report = getLatestReport();
  const leadEvent = report.topEvents[0];

  return `本地 deterministic 分析：${report.executiveBrief} 你问的是「${question || "今日重点"}」。当前最值得讲的是「${leadEvent.title}」，影响分 ${leadEvent.score}/100；证据来自 ${leadEvent.url}。部署到 Cloudflare 并配置 Workers AI 后，此接口会切换为模型生成答案。`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = body.question?.slice(0, 500) ?? "今天 AI 行业最重要的变化是什么？";

  try {
    const { env } = getCloudflareContext({ async: false });
    const model = env.CLOUDFLARE_AI_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";

    if (env.AI) {
      const result = (await env.AI.run(model, {
        messages: [
          {
            role: "system",
            content:
              "You are an AI industry analyst. Answer in concise Chinese using only the provided structured daily report context."
          },
          {
            role: "user",
            content: `Question: ${question}\n\nStructured report context:\n${buildContext()}`
          }
        ],
        temperature: 0.2,
        max_tokens: 700
      })) as { response?: string };

      return NextResponse.json({
        provider: "cloudflare_workers_ai",
        model,
        answer: result.response ?? fallbackAnswer(question)
      });
    }
  } catch {
    // Local next dev does not expose Cloudflare bindings; fall back to a reproducible answer.
  }

  return NextResponse.json({
    provider: "deterministic",
    answer: fallbackAnswer(question)
  });
}
