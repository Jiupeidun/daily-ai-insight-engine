import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL } from "@/lib/insight/extract";
import { getLatestReport } from "@/lib/report-data";

type RuntimeEnv = {
  AI_PROVIDER?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  CLOUDFLARE_AI_MODEL?: string;
  AI?: {
    run: (model: string, input: unknown) => Promise<unknown>;
  };
};

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

  return `本地 fallback 分析：${report.executiveBrief} 你问的是「${question || "今日重点"}」。当前最值得讲的是「${leadEvent.title}」，影响分 ${leadEvent.score}/100；证据来自 ${leadEvent.url}。配置 OpenAI 服务端 API key 后，此接口会切换为模型生成答案。`;
}

function resolveRuntimeEnv(): RuntimeEnv {
  try {
    return getCloudflareContext({ async: false }).env as RuntimeEnv;
  } catch {
    return process.env as RuntimeEnv;
  }
}

async function callOpenAi(question: string, env: RuntimeEnv) {
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const baseUrl = (env.AI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");

  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
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
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    provider: "openai",
    model,
    answer: data.choices?.[0]?.message?.content ?? fallbackAnswer(question)
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = body.question?.slice(0, 500) ?? "今天 AI 行业最重要的变化是什么？";

  try {
    const env = resolveRuntimeEnv();
    const provider = env.AI_PROVIDER ?? "openai_compatible";

    if (provider === "openai_compatible") {
      const answer = await callOpenAi(question, env);
      if (answer) {
        return NextResponse.json(answer);
      }
    }

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
